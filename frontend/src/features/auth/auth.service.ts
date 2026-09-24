import { API_CONFIG } from "@/config/api";

export async function loginService(userKey: string, password = "abc@123") {
  const res = await fetch(`${API_CONFIG.webBackendBaseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email: userKey, password })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Invalid credentials");
  }

  return await res.json();
}
