import { useState } from "react";
import { useAuth } from "../auth/useAuth";
import { fetchUserProfile } from "./user.service";
import { mapUser } from "./user.mapper";

export function useUser() {
  const { currentUser, setCurrentUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const refreshUser = async () => {
    const token = localStorage.getItem("store:token");
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchUserProfile(token);
      setCurrentUser(mapUser(data));
    } catch (e) {
      console.error("Failed to refresh user details:", e);
    } finally {
      setLoading(false);
    }
  };

  return {
    user: currentUser,
    loading,
    refreshUser
  };
}
