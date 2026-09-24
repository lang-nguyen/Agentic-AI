import { API_CONFIG } from "@/config/api";

export async function fetchUserProfile(token: string) {
  const res = await fetch(`${API_CONFIG.webBackendBaseUrl}/api/users`, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });
  if (!res.ok) {
    throw new Error("Failed to fetch user profile");
  }
  return await res.json();
}
