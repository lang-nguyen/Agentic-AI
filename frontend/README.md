# Frontend — LKStore Agent Chat UI

A **Next.js** chat interface that connects to the LangGraph AI agent server, allowing users and admins to submit return/exchange requests and receive autonomous AI decisions in real time.

## Tech Stack

- Next.js 15, React
- Tailwind CSS
- `pnpm`

## Setup

```bash
pnpm install
pnpm dev
# → http://localhost:3000
```

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
NEXT_PUBLIC_API_URL=http://localhost:2024   # LangGraph server URL
NEXT_PUBLIC_ASSISTANT_ID=agent              # Graph/assistant name
NEXT_PUBLIC_AUTH_SCHEME=                   # Leave empty for local dev
```

When set, the app skips the setup form and connects directly.

## Usage

1. Open `http://localhost:3000`
2. Enter the **LangGraph server URL** and **Assistant ID** (or pre-configure via env vars)
3. Start chatting — submit a return/exchange request and the AI agent will process it autonomously

## Production

For production deployments, set the API proxy variables:

```bash
NEXT_PUBLIC_ASSISTANT_ID=agent
LANGGRAPH_API_URL=https://your-langgraph-deployment.com
NEXT_PUBLIC_API_URL=https://your-site.com/api
LANGSMITH_API_KEY=lsv2_...
```
