import os
import httpx
from urllib.parse import quote
from typing import List, Optional

DEFAULT_BASE_URL = os.getenv("WEB_PORTAL_BASE_URL", "http://localhost:8080")

# Module-level cache for the JWT token
_cached_jwt_token = None

async def _get_auth_headers() -> dict:
    """Helper to dynamically fetch and cache a JWT token from Spring Boot."""
    global _cached_jwt_token
    if _cached_jwt_token is None:
        login_url = f"{DEFAULT_BASE_URL}/api/auth/login"
        try:
            # Attempt to login using the default user
            async with httpx.AsyncClient() as client:
                r = await client.post(
                    login_url,
                    json={"email": "ivan_santos_6635", "password": "abc@123"},
                    timeout=5.0
                )
                if r.status_code == 200:
                    _cached_jwt_token = r.json().get("token")
                    print(f"Agent logged in successfully. Token cached.")
                else:
                    print(f"Agent failed to login. Status: {r.status_code}, Body: {r.text}")
        except Exception as e:
            print(f"Connection error requesting JWT token from Spring Boot: {e}")

    if _cached_jwt_token:
        return {"Authorization": f"Bearer {_cached_jwt_token}"}
    return {}

async def get_return_request_reasons() -> List[str]:
    """Retrieve the list of valid return request reasons from the Spring Boot backend."""
    url = f"{DEFAULT_BASE_URL}/api/return-requests/reasons"
    headers = await _get_auth_headers()
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        print(f"Error fetching return reasons from backend: {e}")
        # Return fallback reasons to avoid breaking execution
        return ["wrong_size", "wrong_color", "wrong_item", "damaged_item", "changed_mind", "poor_quality", "other"]

_cached_agent_jwt_token = None

async def _get_agent_auth_headers() -> dict:
    """Helper to dynamically fetch and cache a JWT token for the AI Agent."""
    global _cached_agent_jwt_token
    if _cached_agent_jwt_token is None:
        login_url = f"{DEFAULT_BASE_URL}/api/auth/login"
        try:
            async with httpx.AsyncClient() as client:
                r = await client.post(
                    login_url,
                    json={"email": "agent@store.com", "password": "abc@123"},
                    timeout=5.0
                )
                if r.status_code == 200:
                    _cached_agent_jwt_token = r.json().get("token")
                    print(f"AI Agent logged in successfully. Token cached.")
                else:
                    print(f"AI Agent failed to login. Status: {r.status_code}, Body: {r.text}")
        except Exception as e:
            print(f"Connection error requesting Agent JWT token from Spring Boot: {e}")

    if _cached_agent_jwt_token:
        return {"Authorization": f"Bearer {_cached_agent_jwt_token}"}
    return {}

async def get_return_requests() -> List[dict]:
    """Retrieve the list of return requests from the Spring Boot backend."""
    url = f"{DEFAULT_BASE_URL}/api/return-requests"
    headers = await _get_auth_headers()
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        print(f"Error fetching return requests from backend: {e}")
        return []

async def get_admin_return_requests() -> List[dict]:
    """Retrieve the complete list of return requests from Spring Boot backend using admin privileges."""
    url = f"{DEFAULT_BASE_URL}/api/admin/return-requests"
    headers = await _get_agent_auth_headers()
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        print(f"Error fetching admin return requests: {e}")
        return []

async def send_return_decision(payload: dict) -> dict:
    """Send return request evaluation decision to the webhook."""
    url = f"{DEFAULT_BASE_URL}/api/return-requests/webhook"
    headers = await _get_agent_auth_headers()
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        print(f"Error sending return decision webhook: {e}")
        return {}

async def create_return_request(
    order_id: str,
    claim_type: str,
    reason: str,
    item_ids: List[str],
    payment_method_id: Optional[str] = None,
    customer_comment: Optional[str] = None
) -> dict:
    """Submit a return or exchange request to the Spring Boot backend portal."""
    url = f"{DEFAULT_BASE_URL}/api/return-requests"
    headers = await _get_auth_headers()
    payload = {
        "order_id": order_id,
        "type": claim_type.upper(),
        "reason": reason,
        "customer_comment": customer_comment,
        "payment_method_id": payment_method_id,
        "item_ids": item_ids
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()

async def update_admin_return_request_status(return_id: str, status: str, action: str) -> dict:
    """Update return request status and action via the secure admin PUT API."""
    url = f"{DEFAULT_BASE_URL}/api/admin/return-requests/{return_id}/status"
    headers = await _get_agent_auth_headers()
    try:
        async with httpx.AsyncClient() as client:
            response = await client.put(
                url,
                json={"status": status, "action": action},
                headers=headers
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        print(f"Error updating return request status: {e}")
        return {}

async def get_order_by_id(order_id: str) -> dict:
    encoded_id = quote(order_id, safe='')
    url = f"{DEFAULT_BASE_URL}/api/orders/{encoded_id}"
    headers = await _get_auth_headers()
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        print(f"Error fetching order {order_id} from backend: {e}")
        return {}

async def get_user_order() -> dict:
    url = f"{DEFAULT_BASE_URL}/api/orders"
    headers = await _get_auth_headers()
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        print(f"Error fetching user order from backend: {e}")
        return {}

async def get_current_user() -> dict:
    url = f"{DEFAULT_BASE_URL}/api/users"
    headers = await _get_auth_headers()
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        return {}