"""FastAPI API routes for the Knowledge Graph application.

All route handlers are async so FastAPI can serve multiple requests
concurrently. The slow LLM extraction is awaited (it runs in a
thread-pool executor inside groq_service), freeing the event loop
while the AI call is in progress.
"""

import logging
from typing import List, Optional

import pdfplumber
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Query, Response
from pydantic import BaseModel
from sqlalchemy import text as sa_text, func
from sqlalchemy.orm import Session

from app.config import MAX_WORKSPACES
from app.database import get_db
from app.groq_service import extract_from_text, ping_groq, generate_workspace_name
from app.models import Document, Entity, Relationship, Snippet, Workspace

logger = logging.getLogger(__name__)
router = APIRouter()


# ────────────────────── Pydantic Schemas ──────────────────────


class WorkspaceOut(BaseModel):
    id: int
    name: Optional[str] = None
    created_at: str
    document_count: int = 0
    entity_count: int = 0
    relationship_count: int = 0

    class Config:
        from_attributes = True


class WorkspaceDetailOut(BaseModel):
    id: int
    name: Optional[str] = None
    created_at: str
    documents: List["DocumentOut"]
    entity_count: int
    relationship_count: int


class DocumentOut(BaseModel):
    id: int
    filename: str
    text_length: int


class NodeOut(BaseModel):
    id: int
    name: str
    type: str
    connection_count: int = 0


class LinkOut(BaseModel):
    source: int
    target: int
    type: str
    id: int


class GraphOut(BaseModel):
    nodes: List[NodeOut]
    links: List[LinkOut]


class SnippetOut(BaseModel):
    id: int
    source_text: str
    document_filename: str


class EntityDetailOut(BaseModel):
    id: int
    name: str
    type: str
    snippets: List[SnippetOut]
    relationships: List["RelationshipDetailOut"]


class RelationshipDetailOut(BaseModel):
    id: int
    type: str
    source_name: str
    target_name: str
    direction: str  # "outgoing" or "incoming"


class MergeRequest(BaseModel):
    keep_id: int
    merge_id: int


class EntityUpdateRequest(BaseModel):
    name: str | None = None
    type: str | None = None


class CreateRelationshipRequest(BaseModel):
    source_id: int
    target_id: int
    type: str


class CreateEntityRequest(BaseModel):
    workspace_id: int
    name: str
    type: str


class WorkspaceRenameRequest(BaseModel):
    name: str


class HealthOut(BaseModel):
    db: str
    llm: str


class DeleteOut(BaseModel):
    detail: str


class StatsOut(BaseModel):
    total_workspaces: int
    total_documents: int
    total_entities: int
    total_relationships: int
    total_snippets: int


# ────────────────────── Helpers ──────────────────────


def _enforce_workspace_limit(db: Session) -> bool:
    """Delete the oldest workspaces if the total exceeds MAX_WORKSPACES.
    Returns True if any workspace was deleted.
    """
    count = db.query(Workspace).count()
    evicted = False
    if count >= MAX_WORKSPACES:
        oldest = (
            db.query(Workspace)
            .order_by(Workspace.created_at.asc())
            .limit(count - MAX_WORKSPACES + 1)
            .all()
        )
        for ws in oldest:
            logger.info("Auto-deleting oldest workspace #%d to stay within limit of %d", ws.id, MAX_WORKSPACES)
            db.delete(ws)
            evicted = True
        db.commit()
    return evicted


def _extract_pdf_text(file: UploadFile) -> str:
    """Extract text from a PDF using pdfplumber."""
    text = ""
    try:
        with pdfplumber.open(file.file) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        logger.error("Failed to extract text from PDF %s: %s", file.filename, e)
    return text


async def _read_text_file(file: UploadFile) -> str:
    """Read a plain-text / markdown / csv file asynchronously."""
    raw = await file.read()
    return raw.decode("utf-8", errors="replace")


def _build_workspace_out(ws: Workspace, db: Session) -> WorkspaceOut:
    """Build a WorkspaceOut with aggregate counts."""
    doc_count = db.query(func.count(Document.id)).filter(Document.workspace_id == ws.id).scalar() or 0
    ent_count = db.query(func.count(Entity.id)).filter(Entity.workspace_id == ws.id).scalar() or 0
    rel_count = db.query(func.count(Relationship.id)).filter(Relationship.workspace_id == ws.id).scalar() or 0
    return WorkspaceOut(
        id=ws.id,
        name=ws.name,
        created_at=ws.created_at.isoformat(),
        document_count=doc_count,
        entity_count=ent_count,
        relationship_count=rel_count,
    )


def _build_graph_out(workspace_id: int, db: Session) -> GraphOut:
    """Build the GraphOut for a workspace (reusable by get_graph and merge)."""
    entities = db.query(Entity).filter(Entity.workspace_id == workspace_id).all()
    relationships = db.query(Relationship).filter(Relationship.workspace_id == workspace_id).all()

    entity_ids = {e.id for e in entities}
    connection_counts: dict[int, int] = {eid: 0 for eid in entity_ids}
    for r in relationships:
        if r.source_id in connection_counts:
            connection_counts[r.source_id] += 1
        if r.target_id in connection_counts:
            connection_counts[r.target_id] += 1

    nodes = [
        NodeOut(
            id=e.id,
            name=e.name,
            type=e.type,
            connection_count=connection_counts.get(e.id, 0),
        )
        for e in entities
    ]
    links = [
        LinkOut(source=r.source_id, target=r.target_id, type=r.type, id=r.id)
        for r in relationships
    ]
    return GraphOut(nodes=nodes, links=links)


# ────────────────────── Endpoints ──────────────────────

# ── Workspace Endpoints ──


@router.get("/workspaces", response_model=List[WorkspaceOut])
async def list_workspaces(db: Session = Depends(get_db)):
    """Return the last 5 workspaces, newest first, with aggregate counts."""
    workspaces = (
        db.query(Workspace)
        .order_by(Workspace.created_at.desc())
        .limit(MAX_WORKSPACES)
        .all()
    )
    return [_build_workspace_out(ws, db) for ws in workspaces]


@router.get("/workspaces/{workspace_id}", response_model=WorkspaceDetailOut)
async def get_workspace_detail(workspace_id: int, db: Session = Depends(get_db)):
    """Return full workspace details including document list and stats."""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    documents = db.query(Document).filter(Document.workspace_id == workspace_id).all()
    ent_count = db.query(func.count(Entity.id)).filter(Entity.workspace_id == workspace_id).scalar() or 0
    rel_count = db.query(func.count(Relationship.id)).filter(Relationship.workspace_id == workspace_id).scalar() or 0

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


@router.delete("/workspaces/{workspace_id}", response_model=DeleteOut)
async def delete_workspace(workspace_id: int, db: Session = Depends(get_db)):
    """Delete a workspace and all its associated data (cascaded)."""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    db.delete(workspace)
    db.commit()
    logger.info("Deleted workspace #%d", workspace_id)
    return DeleteOut(detail=f"Workspace {workspace_id} deleted successfully")


@router.patch("/workspaces/{workspace_id}", response_model=WorkspaceOut)
async def rename_workspace(
    workspace_id: int,
    body: WorkspaceRenameRequest,
    db: Session = Depends(get_db),
):
    """Rename a workspace."""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    new_name = body.name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Workspace name cannot be empty")

    workspace.name = new_name
    db.commit()
    db.refresh(workspace)
    logger.info("Renamed workspace #%d to '%s'", workspace_id, new_name)
    return _build_workspace_out(workspace, db)


@router.post("/workspaces/upload", response_model=WorkspaceOut)
async def upload_workspace(
    files: List[UploadFile] = File(...),
    response: Response = None,
    db: Session = Depends(get_db),
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
    evicted = _enforce_workspace_limit(db)
    if evicted:
        response.headers["X-Workspace-Evicted"] = "true"

    # Create workspace
    workspace = Workspace(name="Naming in progress...")
    db.add(workspace)
    db.flush()  # get workspace.id
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
        db.flush()
        cumulative_text += raw_text + "\n"

        # ── LLM extraction — awaited, runs in thread-pool ──
        extraction = await extract_from_text(raw_text)

        # Build entity map: name (lower) -> Entity ORM object
        entity_map: dict[str, Entity] = {}

        # Seed map with any entities already saved (from previous files)
        existing_entities = db.query(Entity).filter(Entity.workspace_id == workspace.id).all()
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
                db.flush()
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
            db.flush()
            total_relationships += 1

            snippet = Snippet(
                relationship_id=rel.id,
                document_id=doc.id,
                source_text=source_text or f"{src_entity.name} {rtype} {tgt_entity.name}",
            )
            db.add(snippet)

    # Generate workspace name from cumulative text
    workspace.name = await generate_workspace_name(cumulative_text)

    db.commit()
    db.refresh(workspace)
    logger.info(
        "Workspace #%d complete: %d entities, %d relationships extracted",
        workspace.id, total_entities, total_relationships,
    )

    return _build_workspace_out(workspace, db)


# ── Graph Endpoints ──


@router.get("/workspaces/{workspace_id}/graph", response_model=GraphOut)
async def get_graph(workspace_id: int, db: Session = Depends(get_db)):
    """Return nodes and links for react-force-graph-2d."""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return _build_graph_out(workspace_id, db)


# ── Entity Endpoints ──


@router.get("/entities/{entity_id}/details", response_model=EntityDetailOut)
async def get_entity_details(entity_id: int, db: Session = Depends(get_db)):
    """Return entity info plus all linked snippets and relationships."""
    entity = db.query(Entity).filter(Entity.id == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    snippets = db.query(Snippet).filter(Snippet.entity_id == entity_id).all()
    snippet_outs = []
    for s in snippets:
        doc = db.query(Document).filter(Document.id == s.document_id).first()
        snippet_outs.append(
            SnippetOut(
                id=s.id,
                source_text=s.source_text,
                document_filename=doc.filename if doc else "unknown",
            )
        )

    outgoing = db.query(Relationship).filter(Relationship.source_id == entity_id).all()
    incoming = db.query(Relationship).filter(Relationship.target_id == entity_id).all()

    rel_details: list[RelationshipDetailOut] = []
    for r in outgoing:
        target = db.query(Entity).filter(Entity.id == r.target_id).first()
        rel_details.append(
            RelationshipDetailOut(
                id=r.id,
                type=r.type,
                source_name=entity.name,
                target_name=target.name if target else "unknown",
                direction="outgoing",
            )
        )
    for r in incoming:
        source = db.query(Entity).filter(Entity.id == r.source_id).first()
        rel_details.append(
            RelationshipDetailOut(
                id=r.id,
                type=r.type,
                source_name=source.name if source else "unknown",
                target_name=entity.name,
                direction="incoming",
            )
        )

    return EntityDetailOut(
        id=entity.id,
        name=entity.name,
        type=entity.type,
        snippets=snippet_outs,
        relationships=rel_details,
    )


@router.get("/workspaces/{workspace_id}/entities", response_model=List[NodeOut])
async def list_entities(
    workspace_id: int,
    search: Optional[str] = Query(None, description="Filter entities by name"),
    db: Session = Depends(get_db),
):
    """List all entities in a workspace, optionally filtered by name."""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    query = db.query(Entity).filter(Entity.workspace_id == workspace_id)
    if search:
        query = query.filter(Entity.name.ilike(f"%{search}%"))
    entities = query.all()

    relationships = db.query(Relationship).filter(Relationship.workspace_id == workspace_id).all()
    conn_counts: dict[int, int] = {}
    for r in relationships:
        conn_counts[r.source_id] = conn_counts.get(r.source_id, 0) + 1
        conn_counts[r.target_id] = conn_counts.get(r.target_id, 0) + 1

    return [
        NodeOut(id=e.id, name=e.name, type=e.type, connection_count=conn_counts.get(e.id, 0))
        for e in entities
    ]


@router.patch("/entities/{entity_id}", response_model=EntityDetailOut)
async def update_entity(
    entity_id: int,
    body: EntityUpdateRequest,
    db: Session = Depends(get_db),
):
    """Update an entity's name and/or type."""
    entity = db.query(Entity).filter(Entity.id == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    if body.name is not None:
        new_name = body.name.strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="Entity name cannot be empty")
        # Check for duplicate names in the same workspace (case-insensitive)
        duplicate = (
            db.query(Entity)
            .filter(
                Entity.workspace_id == entity.workspace_id,
                Entity.id != entity.id,
                func.lower(Entity.name) == new_name.lower(),
            )
            .first()
        )
        if duplicate:
            raise HTTPException(
                status_code=409,
                detail=f"An entity named '{duplicate.name}' already exists in this workspace. Use merge instead.",
            )
        entity.name = new_name

    if body.type is not None:
        new_type = body.type.strip()
        if not new_type:
            raise HTTPException(status_code=400, detail="Entity type cannot be empty")
        entity.type = new_type

    db.commit()
    db.refresh(entity)
    logger.info("Updated entity #%d: name=%s, type=%s", entity.id, entity.name, entity.type)

    # Re-build entity details for the response
    snippets = db.query(Snippet).filter(Snippet.entity_id == entity_id).all()
    snippet_outs = []
    for s in snippets:
        doc = db.query(Document).filter(Document.id == s.document_id).first()
        snippet_outs.append(
            SnippetOut(
                id=s.id,
                source_text=s.source_text,
                document_filename=doc.filename if doc else "unknown",
            )
        )

    outgoing = db.query(Relationship).filter(Relationship.source_id == entity_id).all()
    incoming = db.query(Relationship).filter(Relationship.target_id == entity_id).all()
    rel_details: list[RelationshipDetailOut] = []
    for r in outgoing:
        target = db.query(Entity).filter(Entity.id == r.target_id).first()
        rel_details.append(
            RelationshipDetailOut(
                id=r.id, type=r.type,
                source_name=entity.name,
                target_name=target.name if target else "unknown",
                direction="outgoing",
            )
        )
    for r in incoming:
        source = db.query(Entity).filter(Entity.id == r.source_id).first()
        rel_details.append(
            RelationshipDetailOut(
                id=r.id, type=r.type,
                source_name=source.name if source else "unknown",
                target_name=entity.name,
                direction="incoming",
            )
        )

    return EntityDetailOut(
        id=entity.id,
        name=entity.name,
        type=entity.type,
        snippets=snippet_outs,
        relationships=rel_details,
    )


# ── Relationship Endpoints ──


@router.post("/relationships", response_model=GraphOut)
async def create_relationship(
    body: CreateRelationshipRequest,
    db: Session = Depends(get_db),
):
    """Create a new relationship between two entities."""
    source = db.query(Entity).filter(Entity.id == body.source_id).first()
    target = db.query(Entity).filter(Entity.id == body.target_id).first()
    if not source or not target:
        raise HTTPException(status_code=404, detail="One or both entities not found")
    if source.workspace_id != target.workspace_id:
        raise HTTPException(status_code=400, detail="Entities must belong to the same workspace")
    if source.id == target.id:
        raise HTTPException(status_code=400, detail="Cannot create a relationship from an entity to itself")

    rel_type = body.type.strip()
    if not rel_type:
        raise HTTPException(status_code=400, detail="Relationship type cannot be empty")

    # Check for duplicate relationship
    existing = (
        db.query(Relationship)
        .filter(
            Relationship.source_id == source.id,
            Relationship.target_id == target.id,
            func.lower(Relationship.type) == rel_type.lower(),
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A '{rel_type}' relationship already exists between these entities.",
        )

    rel = Relationship(
        workspace_id=source.workspace_id,
        source_id=source.id,
        target_id=target.id,
        type=rel_type,
    )
    db.add(rel)
    db.commit()
    logger.info(
        "Created relationship #%d: %s -[%s]-> %s",
        rel.id, source.name, rel_type, target.name,
    )

    return _build_graph_out(source.workspace_id, db)


@router.delete("/relationships/{relationship_id}", response_model=GraphOut)
async def delete_relationship(
    relationship_id: int,
    db: Session = Depends(get_db),
):
    """Delete a single relationship by ID."""
    rel = db.query(Relationship).filter(Relationship.id == relationship_id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")
    workspace_id = rel.workspace_id
    logger.info("Deleting relationship #%d (%s)", rel.id, rel.type)
    db.delete(rel)
    db.commit()
    return _build_graph_out(workspace_id, db)


# ── Entity Create / Delete ──


@router.post("/entities", response_model=GraphOut)
async def create_entity(
    body: CreateEntityRequest,
    db: Session = Depends(get_db),
):
    """Create a new entity in a workspace."""
    ws = db.query(Workspace).filter(Workspace.id == body.workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    name = body.name.strip()
    etype = body.type.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Entity name cannot be empty")
    if not etype:
        raise HTTPException(status_code=400, detail="Entity type cannot be empty")

    # Check for duplicate name in the same workspace
    existing = (
        db.query(Entity)
        .filter(
            Entity.workspace_id == body.workspace_id,
            func.lower(Entity.name) == name.lower(),
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"An entity named '{name}' already exists in this workspace.",
        )

    entity = Entity(workspace_id=body.workspace_id, name=name, type=etype)
    db.add(entity)
    db.commit()
    logger.info("Created entity #%d: %s (%s)", entity.id, name, etype)
    return _build_graph_out(body.workspace_id, db)


@router.delete("/entities/{entity_id}", response_model=GraphOut)
async def delete_entity(
    entity_id: int,
    db: Session = Depends(get_db),
):
    """Delete an entity and all its relationships / snippets (via cascade)."""
    entity = db.query(Entity).filter(Entity.id == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    workspace_id = entity.workspace_id
    logger.info("Deleting entity #%d (%s)", entity.id, entity.name)
    db.delete(entity)
    db.commit()
    return _build_graph_out(workspace_id, db)


# ── Merge Endpoint ──


@router.post("/entities/merge", response_model=GraphOut)
async def merge_entities(body: MergeRequest, db: Session = Depends(get_db)):
    """Merge two entities: reassign relationships from merge_id to keep_id, delete merge_id."""
    keep = db.query(Entity).filter(Entity.id == body.keep_id).first()
    merge = db.query(Entity).filter(Entity.id == body.merge_id).first()
    if not keep or not merge:
        raise HTTPException(status_code=404, detail="One or both entities not found")
    if keep.workspace_id != merge.workspace_id:
        raise HTTPException(status_code=400, detail="Entities must belong to the same workspace")
    if keep.id == merge.id:
        raise HTTPException(status_code=400, detail="Cannot merge an entity with itself")

    workspace_id = keep.workspace_id
    logger.info("Merging entity #%d (%s) into #%d (%s)", merge.id, merge.name, keep.id, keep.name)

    # Reassign relationships
    db.query(Relationship).filter(Relationship.source_id == merge.id).update(
        {"source_id": keep.id}, synchronize_session=False
    )
    db.query(Relationship).filter(Relationship.target_id == merge.id).update(
        {"target_id": keep.id}, synchronize_session=False
    )

    # Remove self-referencing relationships created by the merge
    db.query(Relationship).filter(
        Relationship.source_id == keep.id,
        Relationship.target_id == keep.id,
    ).delete(synchronize_session=False)

    # Remove duplicate relationships (same source, target, type) — keep lowest ID
    all_rels = (
        db.query(Relationship)
        .filter(Relationship.workspace_id == workspace_id)
        .all()
    )
    seen_rels: dict[tuple[int, int, str], int] = {}
    ids_to_delete: list[int] = []
    for r in all_rels:
        key = (r.source_id, r.target_id, r.type.lower())
        if key in seen_rels:
            ids_to_delete.append(r.id)
        else:
            seen_rels[key] = r.id
    if ids_to_delete:
        db.query(Relationship).filter(Relationship.id.in_(ids_to_delete)).delete(synchronize_session=False)
        logger.info("Cleaned up %d duplicate relationships after merge", len(ids_to_delete))

    # Reassign snippets
    db.query(Snippet).filter(Snippet.entity_id == merge.id).update(
        {"entity_id": keep.id}, synchronize_session=False
    )

    db.delete(merge)
    db.commit()
    logger.info("Merge complete. Entity #%d deleted, kept #%d", merge.id, keep.id)

    return _build_graph_out(workspace_id, db)


# ── Health & Stats ──


@router.get("/health", response_model=HealthOut)
async def health_check(db: Session = Depends(get_db)):
    """Health check: verify DB connectivity and Groq API reachability."""
    db_status = "error"
    try:
        db.execute(sa_text("SELECT 1"))
        db_status = "ok"
    except Exception as e:
        logger.error("DB health check failed: %s", e)

    llm_status = "ok" if await ping_groq() else "error"

    return HealthOut(db=db_status, llm=llm_status)


@router.get("/stats", response_model=StatsOut)
async def get_stats(db: Session = Depends(get_db)):
    """Return global statistics across all workspaces."""
    return StatsOut(
        total_workspaces=db.query(func.count(Workspace.id)).scalar() or 0,
        total_documents=db.query(func.count(Document.id)).scalar() or 0,
        total_entities=db.query(func.count(Entity.id)).scalar() or 0,
        total_relationships=db.query(func.count(Relationship.id)).scalar() or 0,
        total_snippets=db.query(func.count(Snippet.id)).scalar() or 0,
    )
