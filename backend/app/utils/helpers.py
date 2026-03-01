import logging
import pdfplumber
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select

from app.models.sql import Workspace, Document, Entity, Relationship
from app.schemas.pydantic_models import WorkspaceOut, GraphOut, NodeOut, LinkOut
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
MAX_WORKSPACES = settings.MAX_WORKSPACES

async def _enforce_workspace_limit(db: AsyncSession) -> bool:
    count = await db.scalar(select(func.count(Workspace.id)))
    count = count or 0
    evicted = False
    if count >= MAX_WORKSPACES:
        result = await db.execute(select(Workspace).order_by(Workspace.created_at.asc()).limit(count - MAX_WORKSPACES + 1))
        oldest = result.scalars().all()
        for ws in oldest:
            logger.info("Auto-deleting oldest workspace #%d to stay within limit of %d", ws.id, MAX_WORKSPACES)
            await db.delete(ws)
            evicted = True
        await db.commit()
    return evicted

def _extract_pdf_text(file: UploadFile) -> str:
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
    raw = await file.read()
    return raw.decode("utf-8", errors="replace")

async def _build_workspace_out(ws: Workspace, db: AsyncSession) -> WorkspaceOut:
    doc_count = await db.scalar(select(func.count(Document.id)).filter(Document.workspace_id == ws.id)) or 0
    ent_count = await db.scalar(select(func.count(Entity.id)).filter(Entity.workspace_id == ws.id)) or 0
    rel_count = await db.scalar(select(func.count(Relationship.id)).filter(Relationship.workspace_id == ws.id)) or 0
    return WorkspaceOut(
        id=ws.id,
        name=ws.name,
        created_at=ws.created_at.isoformat(),
        document_count=doc_count,
        entity_count=ent_count,
        relationship_count=rel_count,
    )

async def _build_graph_out(workspace_id: int, db: AsyncSession) -> GraphOut:
    entities_res = await db.execute(select(Entity).filter(Entity.workspace_id == workspace_id))
    entities = entities_res.scalars().all()
    
    rels_res = await db.execute(select(Relationship).filter(Relationship.workspace_id == workspace_id))
    relationships = rels_res.scalars().all()

    entity_ids = {e.id for e in entities}
    connection_counts = {eid: 0 for eid in entity_ids}
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
