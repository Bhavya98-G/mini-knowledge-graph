import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from functools import lru_cache
load_dotenv()

class Settings(BaseSettings):
    PG_USER: str = "postgres"
    PG_PASSWORD: str = "postgres"
    PG_DB: str = "knowledgegraph"
    PG_HOST: str = "localhost"
    PG_PORT: int = 5432
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"postgresql+asyncpg://{PG_USER}:{PG_PASSWORD}@{PG_HOST}:{PG_PORT}/{PG_DB}")
    
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    MAX_WORKSPACES: int = 5
    CHUNK_SIZE: int = 2000
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    

@lru_cache
def get_settings() -> Settings:
    return Settings()