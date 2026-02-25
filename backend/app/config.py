import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/knowledgegraph",
)

GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")

MAX_WORKSPACES: int = 5
CHUNK_SIZE: int = 2000
GROQ_MODEL: str = "llama-3.3-70b-versatile"
