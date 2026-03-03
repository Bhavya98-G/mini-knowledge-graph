import logging
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.sql import Workspace, Document, Entity, Relationship, Snippet
from app.worker.groq_service import extract_from_text, generate_workspace_name
from app.utils.helpers import _extract_pdf_text_from_bytes

logger = logging.getLogger(__name__)

async def build_graph_for_workspace(workspace_id: int, file_data: list = None):
    async with AsyncSessionLocal() as db:
        workspace = (await db.execute(select(Workspace).filter(Workspace.id == workspace_id))).scalars().first()
        if not workspace:
            logger.error(f"Workspace {workspace_id} not found")
            return

        if file_data:
            for file_item in file_data:
                filename = file_item.get("filename", "unknown")
                content = file_item.get("content", b"")
                
                if not content:
                    continue

                if filename.lower().endswith(".pdf"):
                    raw_text = await asyncio.to_thread(_extract_pdf_text_from_bytes, content, filename)
                else:
                    raw_text = content.decode("utf-8", errors="replace")

                if not raw_text.strip():
                    continue

                doc = Document(
                    workspace_id=workspace.id,
                    filename=filename,
                    raw_text=raw_text,
                )
                db.add(doc)
            
            await db.commit()
        
        documents = (await db.execute(select(Document).filter(Document.workspace_id == workspace_id))).scalars().all()
        
        total_entities = 0
        total_relationships = 0
        cumulative_text = ""
        
        for doc in documents:
            raw_text = doc.raw_text
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
                    entity = Entity(workspace_id=workspace.id, name=name, type=etype)
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
        
        # Generate workspace name from cumulative text only if not provided by user
        if workspace.name == "Naming in progress...":
            workspace.name = await generate_workspace_name(cumulative_text)
            
        workspace.status = "completed"
        
        await db.commit()
        logger.info(
            "Workspace #%d complete: %d entities, %d relationships extracted",
            workspace.id, total_entities, total_relationships,
        )