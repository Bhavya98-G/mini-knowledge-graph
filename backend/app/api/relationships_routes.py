import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from app.auth.bearer import auth_dependency
from app.core.database import get_db
from app.models.sql import Entity, Relationship
from app.schemas.pydantic_models import GraphOut, CreateRelationshipRequest
from app.utils.helpers import _build_graph_out

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Relationships"],prefix="/relationships")

@router.post("/", response_model=GraphOut)
async def create_relationship(
    body: CreateRelationshipRequest,
    db: AsyncSession = Depends(get_db),
    user_id=Depends(auth_dependency)
):
    """Create a new relationship between two entities."""
    source = (await db.execute(select(Entity).filter(Entity.id == body.source_id))).scalars().first()
    target = (await db.execute(select(Entity).filter(Entity.id == body.target_id))).scalars().first()
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
    existing = (await db.execute(
        select(Relationship)
        .filter(
            Relationship.source_id == source.id,
            Relationship.target_id == target.id,
            func.lower(Relationship.type) == rel_type.lower(),
        )
    )).scalars().first()
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
    await db.commit()
    logger.info(
        "Created relationship #%d: %s -[%s]-> %s",
        rel.id, source.name, rel_type, target.name,
    )

    return await _build_graph_out(source.workspace_id, db)


@router.delete("/{relationship_id}", response_model=GraphOut)
async def delete_relationship(
    relationship_id: int,
    db: AsyncSession = Depends(get_db),
    user_id=Depends(auth_dependency)
):
    """Delete a single relationship by ID."""
    rel = (await db.execute(select(Relationship).filter(Relationship.id == relationship_id))).scalars().first()
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")
    workspace_id = rel.workspace_id
    logger.info("Deleting relationship #%d (%s)", rel.id, rel.type)
    await db.delete(rel)
    await db.commit()
    return await _build_graph_out(workspace_id, db)
