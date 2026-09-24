import asyncio
from datetime import datetime

# Global set of active connections (queues)
sse_clients: set[asyncio.Queue] = set()

async def publish_thread_created(thread_id: str):
    """Publish a THREAD_CREATED event to all connected admin clients."""
    event = {
        "event": "THREAD_CREATED",
        "data": {
            "thread_id": thread_id,
        },
        "created_at": datetime.now().isoformat()
    }
    for queue in list(sse_clients):
        await queue.put(event)

async def publish_new_message(thread_id: str):
    """Publish a NEW_MESSAGE event to all connected admin clients."""
    event = {
        "event": "NEW_MESSAGE",
        "data": {
            "thread_id": thread_id,
        },
        "created_at": datetime.now().isoformat()
    }
    for queue in list(sse_clients):
        await queue.put(event)

async def publish_agent_update():
    """Publish an AGENT_UPDATE event to all connected admin clients."""
    event = {
        "event": "AGENT_UPDATE",
        "data": {
            "timestamp": datetime.now().isoformat()
        },
        "created_at": datetime.now().isoformat()
    }
    for queue in list(sse_clients):
        await queue.put(event)