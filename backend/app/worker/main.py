import asyncio
from arq import create_pool
from arq.connections import RedisSettings
from app.core.config import get_settings
from app.worker.graph_maker import build_graph_for_workspace

settings = get_settings()

async def startup(ctx):
    print("Starting worker...")

async def shutdown(ctx):
    print("Shutting down worker...")

async def perform_task(ctx, workspace_id: int, file_data: list = None):
    print(f"Processing task for workspace: {workspace_id}")
    await build_graph_for_workspace(workspace_id, file_data)

class WorkerSettings:
    redis_settings = RedisSettings(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
    )
    functions = [perform_task]
    on_startup = startup
    on_shutdown = shutdown