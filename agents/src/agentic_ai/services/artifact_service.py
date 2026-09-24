from typing import Any, Dict

class ArtifactService:
    """Service to centralize the logic for creating artifacts."""

    @staticmethod
    def create_user_artifact(profile: Dict[str, Any]) -> Dict[str, Any]:
        """Construct a user artifact from raw profile data."""
        return {
            "name": f"{profile.get('name', {}).get('first_name', '')} {profile.get('name', {}).get('last_name', '')}".strip(),
            "email": profile.get("email"),
            "address": profile.get("address"),
            "orders": profile.get("orders")
        }

    @staticmethod
    def create_order_artifact(order_info: Dict[str, Any]) -> Dict[str, Any]:
        """Construct an order artifact from raw order details."""
        return order_info
