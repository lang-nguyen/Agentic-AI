import { API_CONFIG } from "@/config/api";

export async function fetchOrders(token: string) {
  const res = await fetch(`${API_CONFIG.webBackendBaseUrl}/api/orders`, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });
  if (!res.ok) {
    throw new Error("Failed to fetch orders list");
  }
  return await res.json();
}
