# LKStore — E-Commerce & Agentic AI System

![Java](https://img.shields.io/badge/Java-17+-orange?logo=openjdk) ![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.x-green?logo=springboot) ![MongoDB](https://img.shields.io/badge/MongoDB-7.x-brightgreen?logo=mongodb) ![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python) ![LangGraph](https://img.shields.io/badge/LangGraph-agentic-purple) ![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)

**LKStore** is a full-stack e-commerce platform with an integrated **Agentic AI** system that autonomously handles return/exchange requests using a multi-step reasoning workflow (ReAct pattern).

<img width="1897" height="907" alt="image" src="https://github.com/user-attachments/assets/dbb98449-96c4-4551-883b-9bd4c4f27e74" />


## Architecture

```
┌─────────────┐     REST API     ┌──────────────────┐
│   Frontend  │ ◄──────────────► │     Backend      │
│  (Next.js)  │                  │  (Spring Boot)   │
│  Chat UI    │                  │  + MongoDB       │
└─────────────┘                  └──────────────────┘
                                          ▲
                                          │ HTTP
                                 ┌────────┴─────────┐
                                 │   AI Agents      │
                                 │ (LangGraph/Python)│
                                 └──────────────────┘
```

## Modules

| Module | Description | Tech Stack |
|--------|-------------|------------|
| [`backend/`](./backend/README.md) | Core e-commerce API — products, orders, users | Java 17, Spring Boot, MongoDB |
| [`agents/`](./agents/README.md) | Autonomous AI agent — return/exchange decision-making | Python 3.10+, LangGraph, uv |
| [`frontend/`](./frontend/README.md) | Chat UI to interact with the AI agent | Next.js 15, React, Tailwind CSS |

## Quick Start

**Prerequisites:** Docker Desktop, JDK 17+, Python 3.10+, Node.js, pnpm

### 1. Backend
```bash
cd backend
docker-compose up -d       # Start MongoDB
./mvnw spring-boot:run     # Start Spring Boot (Windows: mvnw.cmd)
# → http://localhost:8080
```

### 2. AI Agent
```bash
cd agents
pip install uv
uv venv .venv && .venv\Scripts\activate
uv sync
langgraph dev              # Start LangGraph server
# → http://localhost:2024
```

### 3. Frontend
```bash
cd frontend
pnpm install
pnpm dev
# → http://localhost:3000
```

> See each module's `README.md` for detailed configuration and environment variables.
