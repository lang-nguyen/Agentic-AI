import asyncio
import json

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from agentic_ai.persistence.events import sse_clients
from agentic_ai.services.smart_return.router import router as smart_return_router

from dotenv import load_dotenv

# Load env variables from .env file
load_dotenv()

app = FastAPI(
    title="Smart Return API",
    description="Stateless rule engine evaluation service for Smart Return policy validation",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(smart_return_router)

import sys
import os

is_langgraph = any("langgraph" in arg for arg in sys.argv) or "LANGGRAPH_API_PORT" in os.environ

if not is_langgraph:
    @app.on_event("startup")
    async def startup_event():
        from agentic_ai.agents.autonomous_return_agent import start_background_agent_worker
        start_background_agent_worker()

LANGGRAPH_API_URL = "http://127.0.0.1:2024"

async def event_generator(queue: asyncio.Queue):
    try:
        while True:
            event = await queue.get()
            event_type = event["event"]
            data_str = json.dumps(event["data"])
            yield f"event: {event_type}\ndata: {data_str}\n\n"
    except asyncio.CancelledError:
        pass
    finally:
        sse_clients.remove(queue)

@app.get("/api/events/admin")
@app.get("/api/events/admin/")
async def sse_events(request: Request):
    queue: asyncio.Queue = asyncio.Queue()
    sse_clients.add(queue)
    return StreamingResponse(event_generator(queue), media_type="text/event-stream")

@app.post("/langgraph/webhook")
async def langgraph_webhook(request: Request):
    payload = await request.json()
    print("\n========== LANGGRAPH WEBHOOK ==========")
    print(json.dumps(payload, indent=2, ensure_ascii=False))

    thread_id = payload.get("thread_id")
    if thread_id:
        print(f"\nFetching thread state: {thread_id}")
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{LANGGRAPH_API_URL}/threads/{thread_id}/state")
            if response.status_code == 200:
                state = response.json()
                print("\n========== MESSAGES ==========")
                messages = state.get("values", {}).get("messages", [])
                for i, msg in enumerate(messages):
                    print(f"\n[{i}]")
                    print("Type:", msg.get("type"))
                    print("Content:", msg.get("content"))
                    if msg.get("tool_calls"):
                        print("Actions:", msg.get("tool_calls"))
                print("==============================\n")
            else:
                print("Cannot get state:", response.status_code, response.text)
    print("=======================================\n")
    return {"status": "received"}

@app.get("/")
async def health_check():
    return {"status": "running"}


