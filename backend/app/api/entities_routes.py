import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select

from app.core.database import get_db
from app.models.sql import Entity, Snippet, Document, Relationship, Workspace
from app.schemas.pydantic_models import (
    EntityDetailOut,
    SnippetOut,
    RelationshipDetailOut,
    EntityUpdateRequest,
    GraphOut,
    CreateEntityRequest,
    MergeRequest,
)
from app.utils.helpers import _build_graph_out

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Entities"], prefix="/entities")

@router.get("/{entity_id}/details", response_model=EntityDetailOut)
async def get_entity_details(entity_id: int, db: AsyncSession = Depends(get_db)):
    """Return entity info plus all linked snippets and relationships."""
    entity = (await db.execute(select(Entity).filter(Entity.id == entity_id))).scalars().first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    snippets = (await db.execute(select(Snippet).filter(Snippet.entity_id == entity_id))).scalars().all()
    snippet_outs = []
    for s in snippets:
        doc = (await db.execute(select(Document).filter(Document.id == s.document_id))).scalars().first()
        snippet_outs.append(
            SnippetOut(
                id=s.id,
                source_text=s.source_text,
                document_filename=doc.filename if doc else "unknown",
            )
        )

    outgoing = (await db.execute(select(Relationship).filter(Relationship.source_id == entity_id))).scalars().all()
    incoming = (await db.execute(select(Relationship).filter(Relationship.target_id == entity_id))).scalars().all()

    rel_details: list[RelationshipDetailOut] = []
    for r in outgoing:
        target = (await db.execute(select(Entity).filter(Entity.id == r.target_id))).scalars().first()
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
        source = (await db.execute(select(Entity).filter(Entity.id == r.source_id))).scalars().first()
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

@router.patch("/{entity_id}", response_model=EntityDetailOut)
async def update_entity(
    entity_id: int,
    body: EntityUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update an entity's name and/or type."""
    entity = (await db.execute(select(Entity).filter(Entity.id == entity_id))).scalars().first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    if body.name is not None:
        new_name = body.name.strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="Entity name cannot be empty")
        # Check for duplicate names in the same workspace (case-insensitive)
        duplicate = (await db.execute(
            select(Entity)
            .filter(
                Entity.workspace_id == entity.workspace_id,
                Entity.id != entity.id,
                func.lower(Entity.name) == new_name.lower(),
            )
        )).scalars().first()
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

    await db.commit()
    await db.refresh(entity)
    logger.info("Updated entity #%d: name=%s, type=%s", entity.id, entity.name, entity.type)

    # Re-build entity details for the response
    snippets = (await db.execute(select(Snippet).filter(Snippet.entity_id == entity_id))).scalars().all()
    snippet_outs = []
    for s in snippets:
        doc = (await db.execute(select(Document).filter(Document.id == s.document_id))).scalars().first()
        snippet_outs.append(
            SnippetOut(
                id=s.id,
                source_text=s.source_text,
                document_filename=doc.filename if doc else "unknown",
            )
        )

    outgoing = (await db.execute(select(Relationship).filter(Relationship.source_id == entity_id))).scalars().all()
    incoming = (await db.execute(select(Relationship).filter(Relationship.target_id == entity_id))).scalars().all()
    rel_details: list[RelationshipDetailOut] = []
    for r in outgoing:
        target = (await db.execute(select(Entity).filter(Entity.id == r.target_id))).scalars().first()
        rel_details.append(
            RelationshipDetailOut(
                id=r.id, type=r.type,
                source_name=entity.name,
                target_name=target.name if target else "unknown",
                direction="outgoing",
            )
        )
    for r in incoming:
        source = (await db.execute(select(Entity).filter(Entity.id == r.source_id))).scalars().first()
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

@router.post("/", response_model=GraphOut)
async def create_entity(
    body: CreateEntityRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create a new entity in a workspace."""
    ws = (await db.execute(select(Workspace).filter(Workspace.id == body.workspace_id))).scalars().first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    name = body.name.strip()
    etype = body.type.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Entity name cannot be empty")
    if not etype:
        raise HTTPException(status_code=400, detail="Entity type cannot be empty")

    # Check for duplicate name in the same workspace
    existing = (await db.execute(
        select(Entity)
        .filter(
            Entity.workspace_id == body.workspace_id,
            func.lower(Entity.name) == name.lower(),
        )
    )).scalars().first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"An entity named '{name}' already exists in this workspace.",
        )

    entity = Entity(workspace_id=body.workspace_id, name=name, type=etype)
    db.add(entity)
    await db.commit()
    logger.info("Created entity #%d: %s (%s)", entity.id, name, etype)
    return await _build_graph_out(body.workspace_id, db)


@router.delete("/{entity_id}", response_model=GraphOut)
async def delete_entity(
    entity_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete an entity and all its relationships / snippets (via cascade)."""
    entity = (await db.execute(select(Entity).filter(Entity.id == entity_id))).scalars().first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    workspace_id = entity.workspace_id
    logger.info("Deleting entity #%d (%s)", entity.id, entity.name)
    await db.delete(entity)
    await db.commit()
    return await _build_graph_out(workspace_id, db)



@router.post("/merge", response_model=GraphOut)
async def merge_entities(body: MergeRequest, db: AsyncSession = Depends(get_db)):
    """Merge two entities: reassign relationships from merge_id to keep_id, delete merge_id."""
    keep = (await db.execute(select(Entity).filter(Entity.id == body.keep_id))).scalars().first()
    merge = (await db.execute(select(Entity).filter(Entity.id == body.merge_id))).scalars().first()
    if not keep or not merge:
        raise HTTPException(status_code=404, detail="One or both entities not found")
    if keep.workspace_id != merge.workspace_id:
        raise HTTPException(status_code=400, detail="Entities must belong to the same workspace")
    if keep.id == merge.id:
        raise HTTPException(status_code=400, detail="Cannot merge an entity with itself")

    workspace_id = keep.workspace_id
    logger.info("Merging entity #%d (%s) into #%d (%s)", merge.id, merge.name, keep.id, keep.name)

    # Reassign relationships
    from sqlalchemy import update
    await db.execute(update(Relationship).where(Relationship.source_id == merge.id).values(source_id=keep.id))
    await db.execute(update(Relationship).where(Relationship.target_id == merge.id).values(target_id=keep.id))

    # Remove self-referencing relationships created by the merge
    from sqlalchemy import delete
    await db.execute(delete(Relationship).where(
        Relationship.source_id == keep.id,
        Relationship.target_id == keep.id,
    ))

    # Remove duplicate relationships (same source, target, type) — keep lowest ID
    all_rels = (await db.execute(
        select(Relationship)
        .filter(Relationship.workspace_id == workspace_id)
    )).scalars().all()
    seen_rels: dict[tuple[int, int, str], int] = {}
    ids_to_delete: list[int] = []
    for r in all_rels:
        key = (r.source_id, r.target_id, r.type.lower())
        if key in seen_rels:
            ids_to_delete.append(r.id)
        else:
            seen_rels[key] = r.id
    if ids_to_delete:
        await db.execute(delete(Relationship).where(Relationship.id.in_(ids_to_delete)))
        logger.info("Cleaned up %d duplicate relationships after merge", len(ids_to_delete))

    # Reassign snippets
    await db.execute(update(Snippet).where(Snippet.entity_id == merge.id).values(entity_id=keep.id))

    await db.delete(merge)
    await db.commit()
    logger.info("Merge complete. Entity #%d deleted, kept #%d", merge.id, keep.id)

    return await _build_graph_out(workspace_id, db)

