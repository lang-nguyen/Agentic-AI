import { API_CONFIG } from "@/config/api";

export async function fetchReturnRequestsApi(token: string) {
  const res = await fetch(`${API_CONFIG.webBackendBaseUrl}/api/return-requests`, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });
  if (!res.ok) {
    throw new Error("Failed to fetch return requests");
  }
  return await res.json();
}
