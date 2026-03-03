import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from .config import get_settings
import redis.asyncio as redis

settings = get_settings()

DATABASE_URL: str = settings.DATABASE_URL

engine = create_async_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    pool_recycle=300,
    echo=False,
)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

redis_pool = redis.ConnectionPool(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0)
redis_client = redis.Redis(connection_pool=redis_pool)

async def get_redis():
    async with redis_client.get_connection() as conn:
        yield conn