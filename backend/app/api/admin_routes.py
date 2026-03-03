from fastapi import APIRouter
from app.core.database import engine
from app.models.sql import Base

router = APIRouter(tags=["Admin"], prefix="/admin")

@router.post("/clear-mysql", tags=["Admin"])
async def clear_mysql_db():
    """
    Drops all tables and recreates them based on the current schema.
    WARNING: This will delete all data in the MySQL database.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    return {"message": "MySQL database cleared and schema recreated successfully"}