"use client";

import React, { createContext, useState, useEffect } from "react";
import type { Order } from "@/types/store";
import { useAuth } from "../auth/useAuth";
import { fetchOrders } from "./order.service";
import { mapOrders } from "./order.mapper";

export interface OrdersContextType {
  orders: Order[];
  loading: boolean;
  refreshOrders: () => Promise<void>;
}

export const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshOrders = async () => {
    const token = localStorage.getItem("store:token");
    if (!token) {
      setOrders([]);
      return;
    }
    setLoading(true);
    try {
      const rawData = await fetchOrders(token);
      setOrders(mapOrders(rawData));
    } catch (e) {
      console.error("Failed to load orders list:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      refreshOrders();
    } else {
      setOrders([]);
    }
  }, [currentUser]);

  return (
    <OrdersContext.Provider
      value={{
        orders,
        loading,
        refreshOrders
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
}
