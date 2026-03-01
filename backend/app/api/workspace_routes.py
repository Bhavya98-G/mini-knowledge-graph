import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, File, UploadFile, Response, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.database import get_db
from app.models.sql import Workspace, Document, Entity, Relationship, Snippet
from app.schemas.pydantic_models import (
    WorkspaceOut,
    WorkspaceDetailOut, 
    DocumentOut, 
    DeleteOut, 
    WorkspaceRenameRequest, 
    GraphOut,
    NodeOut
)
from app.utils.helpers import (
    _build_workspace_out,
    _enforce_workspace_limit,
    _extract_pdf_text,
    _read_text_file,
    _build_graph_out
)
from app.worker.groq_service import extract_from_text, generate_workspace_name

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(tags=["Workspace APIs"], prefix="/workspaces")

@router.post("/upload", response_model=WorkspaceOut)
async def upload_workspace(
    files: List[UploadFile] = File(...),
    response: Response = None,
    db: AsyncSession = Depends(get_db),
):
    """Accept 1-10 files, create a workspace, extract entities & relationships via LangChain/Groq.

    The slow LLM call runs in a thread-pool executor (via await) so the
    event loop stays free to accept other incoming requests while this
    one waits for the AI response.
    """
    if len(files) < 3 or len(files) > 10:
        raise HTTPException(
            status_code=400,
            detail="Please upload between 3 and 10 files.",
        )

    # Enforce max-workspace cap
    evicted = await _enforce_workspace_limit(db)
    if evicted:
        response.headers["X-Workspace-Evicted"] = "true"

    # Create workspace
    workspace = Workspace(name="Naming in progress...")
    db.add(workspace)
    await db.flush()  # get workspace.id
    logger.info("Created workspace #%d with %d files", workspace.id, len(files))

    total_entities = 0
    total_relationships = 0
    cumulative_text = ""

    for upload_file in files:
        filename = upload_file.filename or "unknown"
        logger.info("Processing file: %s", filename)

        if filename.lower().endswith(".pdf"):
            raw_text = _extract_pdf_text(upload_file)
        else:
            raw_text = await _read_text_file(upload_file)

        if not raw_text.strip():
            logger.warning("Skipping empty file: %s", filename)
            continue

        doc = Document(
            workspace_id=workspace.id,
            filename=filename,
            raw_text=raw_text,
        )
        db.add(doc)
        await db.flush()
        cumulative_text += raw_text + "\n"

        # ── LLM extraction — awaited, runs in thread-pool ──
        extraction = await extract_from_text(raw_text)

        # Build entity map: name (lower) -> Entity ORM object
        entity_map: dict[str, Entity] = {}

        # Seed map with any entities already saved (from previous files)
        existing_entities = (await db.execute(select(Entity).filter(Entity.workspace_id == workspace.id))).scalars().all()
        for e in existing_entities:
            entity_map[e.name.lower()] = e

        for ent_data in extraction.get("entities", []):
            name = ent_data.get("name", "").strip()
            etype = ent_data.get("type", "Unknown").strip()
            source_text = ent_data.get("source_text", "").strip()
            if not name:
                continue

            key = name.lower()
            if key not in entity_map:
                entity = Entity(
                    workspace_id=workspace.id, name=name, type=etype
                )
                db.add(entity)
                await db.flush()
                entity_map[key] = entity
                total_entities += 1

            snippet = Snippet(
                entity_id=entity_map[key].id,
                document_id=doc.id,
                source_text=source_text or f"Extracted entity: {name}",
            )
            db.add(snippet)

        for rel_data in extraction.get("relationships", []):
            src_name = rel_data.get("source", "").strip().lower()
            tgt_name = rel_data.get("target", "").strip().lower()
            rtype = rel_data.get("type", "related_to").strip()
            source_text = rel_data.get("source_text", "").strip()

            src_entity = entity_map.get(src_name)
            tgt_entity = entity_map.get(tgt_name)
            if not src_entity or not tgt_entity:
                logger.debug(
                    "Skipping relationship %s -> %s: missing entity in map",
                    src_name, tgt_name,
                )
                continue

            if src_entity.id == tgt_entity.id:
                continue

            rel = Relationship(
                workspace_id=workspace.id,
                source_id=src_entity.id,
                target_id=tgt_entity.id,
                type=rtype,
            )
            db.add(rel)
            await db.flush()
            total_relationships += 1

            snippet = Snippet(
                relationship_id=rel.id,
                document_id=doc.id,
                source_text=source_text or f"{src_entity.name} {rtype} {tgt_entity.name}",
            )
            db.add(snippet)

    # Generate workspace name from cumulative text
    workspace.name = await generate_workspace_name(cumulative_text)

    await db.commit()
    await db.refresh(workspace)
    logger.info(
        "Workspace #%d complete: %d entities, %d relationships extracted",
        workspace.id, total_entities, total_relationships,
    )

    return await _build_workspace_out(workspace, db)

@router.get("/", response_model=List[WorkspaceOut])
async def list_workspaces(db: AsyncSession = Depends(get_db)):
    """Return the last 5 workspaces, newest first, with aggregate counts."""
    result = await db.execute(
        select(Workspace)
        .order_by(Workspace.created_at.desc())
        .limit(settings.MAX_WORKSPACES)
    )
    workspaces = result.scalars().all()
    return [await _build_workspace_out(ws, db) for ws in workspaces]

@router.get("/{workspace_id}", response_model=WorkspaceDetailOut)
async def get_workspace_detail(workspace_id: int, db: AsyncSession = Depends(get_db)):
    """Return full workspace details including document list and stats."""
    workspace = (await db.execute(select(Workspace).filter(Workspace.id == workspace_id))).scalars().first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    documents = (await db.execute(select(Document).filter(Document.workspace_id == workspace_id))).scalars().all()
    ent_count = await db.scalar(select(func.count(Entity.id)).filter(Entity.workspace_id == workspace_id)) or 0
    rel_count = await db.scalar(select(func.count(Relationship.id)).filter(Relationship.workspace_id == workspace_id)) or 0

    return WorkspaceDetailOut(
        id=workspace.id,
        name=workspace.name,
        created_at=workspace.created_at.isoformat(),
        documents=[
            DocumentOut(id=d.id, filename=d.filename, text_length=len(d.raw_text))
            for d in documents
        ],
        entity_count=ent_count,
        relationship_count=rel_count,
    )

@router.delete("/{workspace_id}", response_model=DeleteOut)
async def delete_workspace(workspace_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a workspace and all its associated data (cascaded)."""
    workspace = (await db.execute(select(Workspace).filter(Workspace.id == workspace_id))).scalars().first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    await db.delete(workspace)
    await db.commit()
    logger.info("Deleted workspace #%d", workspace_id)
    return DeleteOut(detail=f"Workspace {workspace_id} deleted successfully")

@router.patch("/{workspace_id}", response_model=WorkspaceOut)
async def rename_workspace(
    workspace_id: int,
    body: WorkspaceRenameRequest,
    db: AsyncSession = Depends(get_db),
):
    """Rename a workspace."""
    workspace = (await db.execute(select(Workspace).filter(Workspace.id == workspace_id))).scalars().first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    new_name = body.name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Workspace name cannot be empty")

    workspace.name = new_name
    await db.commit()
    await db.refresh(workspace)
    logger.info("Renamed workspace #%d to '%s'", workspace_id, new_name)
    return await _build_workspace_out(workspace, db)

@router.get("/{workspace_id}/graph", response_model=GraphOut)
async def get_graph(workspace_id: int, db: AsyncSession = Depends(get_db)):
    """Return nodes and links for react-force-graph-2d."""
    workspace = (await db.execute(select(Workspace).filter(Workspace.id == workspace_id))).scalars().first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return await _build_graph_out(workspace_id, db)

@router.get("/{workspace_id}/entities", response_model=List[NodeOut])
async def list_entities(
    workspace_id: int,
    search: Optional[str] = Query(None, description="Filter entities by name"),
    db: AsyncSession = Depends(get_db),
):
    """List all entities in a workspace, optionally filtered by name."""
    workspace = (await db.execute(select(Workspace).filter(Workspace.id == workspace_id))).scalars().first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    query = select(Entity).filter(Entity.workspace_id == workspace_id)
    if search:
        query = query.filter(Entity.name.ilike(f"%{search}%"))
    entities = (await db.execute(query)).scalars().all()

    relationships = (await db.execute(select(Relationship).filter(Relationship.workspace_id == workspace_id))).scalars().all()
    conn_counts: dict[int, int] = {}
    for r in relationships:
        conn_counts[r.source_id] = conn_counts.get(r.source_id, 0) + 1
        conn_counts[r.target_id] = conn_counts.get(r.target_id, 0) + 1

    return [
        NodeOut(id=e.id, name=e.name, type=e.type, connection_count=conn_counts.get(e.id, 0))
        for e in entities
    ]
