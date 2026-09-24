"use client";

import React, { useState, useEffect } from "react";
import { ClientLayout } from "@/components/user/layout/ClientLayout";
import { Topbar } from "@/components/user/layout/Topbar";
import { SearchArea } from "@/components/user/home/sections/SearchArea";
import { HeroSection } from "@/components/user/home/sections/HeroSection";
import { DoubleFeatures } from "@/components/user/home/sections/DoubleFeatures";
import { Recommendations } from "@/components/user/home/sections/Recommendations";
import { API_CONFIG } from "@/config/api";

export default function HomePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true);
        const res = await fetch(`${API_CONFIG.webBackendBaseUrl}/api/products?size=1000`);
        if (!res.ok) throw new Error("Failed to fetch products");
        const data = await res.json();

        // Helper to get category dynamically from product name
        const getProductCategory = (name: string): string => {
          const n = name.toLowerCase();
          if (n.includes("shirt") || n.includes("hoodie") || n.includes("jacket") || n.includes("pants")) return "Apparel";
          if (n.includes("shoe") || n.includes("sneaker") || n.includes("boot")) return "Footwear";
          if (n.includes("headphone") || n.includes("watch") || n.includes("speaker") || n.includes("phone")) return "Electronics";
          if (n.includes("bag") || n.includes("backpack") || n.includes("wallet")) return "Accessories";
          return "Home & Outdoor";
        };

        // Helper to get consistent rating and review count
        const getProductMetadata = (id: string): { rating: number; reviews: number } => {
          let hash = 0;
          for (let i = 0; i < id.length; i++) {
            hash = id.charCodeAt(i) + ((hash << 5) - hash);
          }
          const rating = 4.0 + (Math.abs(hash) % 10) / 10;
          const reviews = 20 + (Math.abs(hash) % 450);
          return { rating: parseFloat(rating.toFixed(1)), reviews };
        };

        const mapped = data.content.map((p: any) => {
          const { rating, reviews } = getProductMetadata(p.productId);
          return {
            id: p.productId,
            name: p.name,
            price: p.minPrice,
            rating,
            reviews,
            image: p.image || "/images/no-image.png",
            description: p.displayName || p.name,
          };
        });
        setProducts(mapped);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  return (
    <ClientLayout>
      <Topbar />
      <SearchArea />
      <HeroSection />
      {loading ? (
        <div className="max-w-7xl mx-auto py-20 flex flex-col items-center justify-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-600"></div>
        </div>
      ) : (
        <>
          <DoubleFeatures products={products} />
          <Recommendations products={products} />
        </>
      )}
    </ClientLayout>
  );
}
