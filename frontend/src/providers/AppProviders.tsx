"use client";

import React from "react";
import { LocaleProvider } from "@/contexts/locale.context";
import { AuthProvider } from "@/features/auth/auth.context";
import { CartProvider } from "@/features/cart/cart.context";
import { OrdersProvider } from "@/features/orders/order.context";
import { ReturnsProvider } from "@/features/returns/return.context";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <AuthProvider>
        <CartProvider>
          <OrdersProvider>
            <ReturnsProvider>{children}</ReturnsProvider>
          </OrdersProvider>
        </CartProvider>
      </AuthProvider>
    </LocaleProvider>
  );
}
