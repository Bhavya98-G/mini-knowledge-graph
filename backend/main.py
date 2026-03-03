"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import engine
from app.models.sql import Base

from app.api.workspace_routes import router as workspace_router
from app.api.entities_routes import router as entities_router
from app.api.relationships_routes import router as relationships_router
from app.api.health_routes import router as health_router
from app.api.auth_routes import router as auth_router
from app.api.admin_routes import router as admin_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    
    # Shutdown
    await engine.dispose()




app = FastAPI(
    title="Mini Knowledge Graph",
    description="Extract entities & relationships from documents and visualise them as a knowledge graph.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    """
    Root endpoint that returns basic API information.
    """
    return {
        "message": "Welcome to FastAPI Service",
        "status": "active",
        "documentation": "/docs",
        "redoc": "/redoc"
    }

app.include_router(health_router, prefix="/api")
app.include_router(workspace_router, prefix="/api")
app.include_router(entities_router, prefix="/api")
app.include_router(relationships_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
