import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship as sa_relationship, declarative_base


Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(512), nullable=False)
    email = Column(String(512), nullable=False)
    password = Column(String(512), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(512), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    status = Column(String(512), default="running")
    documents = sa_relationship(
        "Document", back_populates="workspace", cascade="all, delete-orphan"
    )
    entities = sa_relationship(
        "Entity", back_populates="workspace", cascade="all, delete-orphan"
    )
    relationships = sa_relationship(
        "Relationship", back_populates="workspace", cascade="all, delete-orphan"
    )


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(512), nullable=False)
    raw_text = Column(Text, nullable=False)

    workspace = sa_relationship("Workspace", back_populates="documents")
    snippets = sa_relationship(
        "Snippet", back_populates="document", cascade="all, delete-orphan"
    )


class Entity(Base):
    __tablename__ = "entities"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(512), nullable=False)
    type = Column(String(128), nullable=False)

    workspace = sa_relationship("Workspace", back_populates="entities")
    snippets = sa_relationship(
        "Snippet", back_populates="entity", cascade="all, delete-orphan"
    )

    # Relationships where this entity is the source
    outgoing_relationships = sa_relationship(
        "Relationship",
        foreign_keys="Relationship.source_id",
        back_populates="source_entity",
        cascade="all, delete-orphan",
    )
    # Relationships where this entity is the target
    incoming_relationships = sa_relationship(
        "Relationship",
        foreign_keys="Relationship.target_id",
        back_populates="target_entity",
        cascade="all, delete-orphan",
    )


class Relationship(Base):
    __tablename__ = "relationships"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    source_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    target_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(256), nullable=False)

    workspace = sa_relationship("Workspace", back_populates="relationships")
    source_entity = sa_relationship(
        "Entity", foreign_keys=[source_id], back_populates="outgoing_relationships"
    )
    target_entity = sa_relationship(
        "Entity", foreign_keys=[target_id], back_populates="incoming_relationships"
    )
    snippets = sa_relationship(
        "Snippet", back_populates="relationship", cascade="all, delete-orphan"
    )


class Snippet(Base):
    __tablename__ = "snippets"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=True)
    relationship_id = Column(Integer, ForeignKey("relationships.id", ondelete="CASCADE"), nullable=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    source_text = Column(Text, nullable=False)

    entity = sa_relationship("Entity", back_populates="snippets")
    relationship = sa_relationship("Relationship", back_populates="snippets")
    document = sa_relationship("Document", back_populates="snippets")
