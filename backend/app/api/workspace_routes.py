import logging
import asyncio
from typing import List, Optional
from fastapi import APIRouter, Depends, File, UploadFile, Response, HTTPException, Query, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from app.auth.bearer import auth_dependency
from app.core.config import get_settings
from app.core.database import get_db
from app.models.sql import Workspace, Document, Entity, Relationship, Snippet
from app.schemas.pydantic_models import (
    WorkspaceOut,
    RunningWorkspaceOut,
    WorkspaceDetailOut, 
    DocumentOut, 
    DeleteOut, 
    WorkspaceRenameRequest, 
    GraphOut,
    NodeOut,
    WorkspaceName
)
from app.utils.helpers import (
    _build_workspace_out,
    _enforce_workspace_limit,
    _extract_pdf_text,
    _build_running_workspace_out,
    _read_text_file,
    _build_graph_out
)
from app.worker.groq_service import generate_workspace_name
from arq import create_pool
from arq.connections import RedisSettings

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(tags=["Workspace APIs"], prefix="/workspaces")

async def get_arq_pool():
    return await create_pool(
        RedisSettings(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
        )
    )
@router.post("/upload", response_model=WorkspaceOut)
async def upload_workspace(
    response: Response,
    name: Optional[str] = Form(None),
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    user_id=Depends(auth_dependency)
):
    """Accept 1-10 files, create a workspace, extract entities & relationships via LangChain/Groq.

    The slow LLM call runs in a thread-pool executor (via await) so the
    event loop stays free to accept other incoming requests while this
    one waits for the AI response.
    """
    if 1 <= len(files) <= 10:

        # Enforce max-workspace cap
        evicted = await _enforce_workspace_limit(db)
        if evicted:
            response.headers["X-Workspace-Evicted"] = "true"

        # Create workspace
        if name and name.strip():
            workspace = Workspace(name=name.strip(), status="running", user_id=user_id)
        else:
            workspace = Workspace(name="Naming in progress...", status="running", user_id=user_id)
        db.add(workspace)
        await db.flush()
        # Extract text directly from uploaded files before they are out of scope
        file_data = []
        for upload_file in files:
            filename = upload_file.filename or "unknown"
            content = await upload_file.read()
            file_data.append({
                "filename": filename,
                "content": content
            })

        logger.info("Created workspace #%d with %d files", workspace.id, len(files))
            
        await db.commit()
        await db.refresh(workspace)
        
        redis = await get_arq_pool()
        await redis.enqueue_job('perform_task', workspace.id, file_data)
        await redis.close()
        return await _build_workspace_out(workspace, db)
    else:
        raise HTTPException(
            status_code=400,
            detail="Please upload between 1 and 10 files.",
        )

@router.get("/completed", response_model=List[WorkspaceOut])
async def list_completed_workspaces(db: AsyncSession = Depends(get_db), user_id=Depends(auth_dependency)):
    """Return the last 5 workspaces, newest first, with aggregate counts."""
    result = await db.execute(
        select(Workspace)
        .filter(Workspace.status == "completed", Workspace.user_id == user_id)
        .order_by(Workspace.created_at.desc())
        .limit(settings.MAX_WORKSPACES)
    )
    workspaces = result.scalars().all()
    return [await _build_workspace_out(ws, db) for ws in workspaces]

@router.get("/running", response_model=List[RunningWorkspaceOut])
async def list_running_workspaces(db: AsyncSession = Depends(get_db), user_id=Depends(auth_dependency)):
    """Return currently running workspaces."""
    result = await db.execute(
        select(Workspace)
        .filter(Workspace.status == "running", Workspace.user_id == user_id)
        .order_by(Workspace.created_at.desc())
        .limit(settings.MAX_WORKSPACES)
    )
    workspaces = result.scalars().all()
    return [await _build_running_workspace_out(ws, db) for ws in workspaces]

@router.get("/{workspace_id}", response_model=WorkspaceDetailOut)
async def get_workspace_detail(workspace_id: int, db: AsyncSession = Depends(get_db), user_id=Depends(auth_dependency)):
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
        status=workspace.status,
    )

@router.delete("/{workspace_id}", response_model=DeleteOut)
async def delete_workspace(workspace_id: int, db: AsyncSession = Depends(get_db), user_id=Depends(auth_dependency)):
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
    user_id=Depends(auth_dependency)
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
async def get_graph(workspace_id: int, db: AsyncSession = Depends(get_db), user_id=Depends(auth_dependency)):
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
    user_id=Depends(auth_dependency)
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
