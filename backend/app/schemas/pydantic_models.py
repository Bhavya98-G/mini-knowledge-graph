from pydantic import BaseModel
from typing import List, Optional

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

