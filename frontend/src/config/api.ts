export const API_CONFIG = {
  // Python FastAPI Rule Engine Service (port 8000)
  rulesEngineBaseUrl: process.env.NEXT_PUBLIC_RULES_ENGINE_API_URL || "http://localhost:8000",

  // Web E-commerce backend service (port 8080)
  webBackendBaseUrl: process.env.NEXT_PUBLIC_WEB_BACKEND_API_URL || "http://localhost:8080",

  // LangGraph API Service (port 8000)
  langgraphBaseUrl: process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "http://localhost:8000"
};
