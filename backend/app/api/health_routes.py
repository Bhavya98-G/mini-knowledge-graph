from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text as sa_text
from sqlalchemy import func
import logging

from app.core.database import get_db
from app.models.sql import Workspace, Document, Entity, Relationship, Snippet
from app.schemas.pydantic_models import HealthOut, StatsOut
from app.worker.groq_service import ping_groq

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Health"])

@router.get("/health", response_model=HealthOut)
async def health_check(db: AsyncSession = Depends(get_db)):
    """Health check: verify DB connectivity and Groq API reachability."""
    db_status = "error"
    try:
        await db.execute(sa_text("SELECT 1"))
        db_status = "ok"
    except Exception as e:
        logger.error("DB health check failed: %s", e)

    llm_status = "ok" if await ping_groq() else "error"

    return HealthOut(db=db_status, llm=llm_status)

from sqlalchemy.future import select

@router.get("/stats", response_model=StatsOut)
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Return global statistics across all workspaces."""
    total_workspaces = await db.scalar(select(func.count(Workspace.id))) or 0
    total_documents = await db.scalar(select(func.count(Document.id))) or 0
    total_entities = await db.scalar(select(func.count(Entity.id))) or 0
    total_relationships = await db.scalar(select(func.count(Relationship.id))) or 0
    total_snippets = await db.scalar(select(func.count(Snippet.id))) or 0
    
    return StatsOut(
        total_workspaces=total_workspaces,
        total_documents=total_documents,
        total_entities=total_entities,
        total_relationships=total_relationships,
        total_snippets=total_snippets,
    )
