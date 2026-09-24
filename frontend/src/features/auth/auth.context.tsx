"use client";

import React, { createContext, useState, useEffect } from "react";
import { toast } from "sonner";
import type { UserProfile } from "@/types/store";
import { loginService } from "./auth.service";
import { mapUser } from "./auth.mapper";
import { fetchUserProfile } from "../user/user.service";
import { AuthContextType } from "./auth.types";

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const loadProfile = async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      const userData = await fetchUserProfile(token);
      setCurrentUser(mapUser(userData));
    } catch (e) {
      console.error("Failed to load user profile:", e);
      setError("Failed to load user profile");
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("store:token");
    if (token) {
      loadProfile(token).finally(() => setIsInitialized(true));
    } else {
      setIsInitialized(true);
    }
  }, []);

  const login = async (userKey: string, password = "abc@123") => {
    setLoading(true);
    setError(null);
    try {
      const data = await loginService(userKey, password);
      localStorage.setItem("store:token", data.token);
      toast.success(`Logged in successfully as ${data.fullName}!`);

      await loadProfile(data.token);
      return true;
    } catch (e) {
      console.error("Login failed:", e);
      setError("Login failed");
      toast.error("Login failed! Please check credentials.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem("store:token");
    toast.info("Logged out from store session");
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        login,
        logout,
        loading,
        error,
        isInitialized
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
