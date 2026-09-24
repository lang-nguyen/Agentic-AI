"use client";

import React, { createContext, useState, useEffect } from "react";
import { toast } from "sonner";

export interface CartContextType {
  cart: Record<string, number>;
  addToCart: (productId: string, productName: string) => void;
  clearCart: () => void;
  getCartTotalItems: () => number;
}

export const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Record<string, number>>({});

  useEffect(() => {
    const storedCart = localStorage.getItem("store:cart");
    if (storedCart) {
      try {
        setCart(JSON.parse(storedCart));
      } catch (e) {
        console.error("Failed to parse cart storage:", e);
      }
    }
  }, []);

  const addToCart = (productId: string, productName: string) => {
    setCart((prev) => {
      const updated = {
        ...prev,
        [productId]: (prev[productId] || 0) + 1
      };
      localStorage.setItem("store:cart", JSON.stringify(updated));
      return updated;
    });
    toast.success(`Added "${productName}" to cart!`);
  };

  const clearCart = () => {
    setCart({});
    localStorage.removeItem("store:cart");
  };

  const getCartTotalItems = () => {
    return Object.values(cart).reduce((a, b) => a + b, 0);
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        clearCart,
        getCartTotalItems
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
