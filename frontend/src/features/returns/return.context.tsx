"use client";

import React, { createContext, useState, useEffect } from "react";
import type { ReturnRequest } from "@/types/store";
import { useAuth } from "../auth/useAuth";
import { fetchReturnRequestsApi } from "./return.service";

export interface ReturnsContextType {
  returnRequests: ReturnRequest[];
  loading: boolean;
  refreshReturnRequests: () => Promise<void>;
}

export const ReturnsContext = createContext<ReturnsContextType | undefined>(undefined);

export function ReturnsProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshReturnRequests = async () => {
    const token = localStorage.getItem("store:token");
    if (!token) {
      setReturnRequests([]);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchReturnRequestsApi(token);
      setReturnRequests(data || []);
    } catch (e) {
      console.error("Failed to load return requests:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      refreshReturnRequests();
    } else {
      setReturnRequests([]);
    }
  }, [currentUser]);

  return (
    <ReturnsContext.Provider
      value={{
        returnRequests,
        loading,
        refreshReturnRequests
      }}
    >
      {children}
    </ReturnsContext.Provider>
  );
}
