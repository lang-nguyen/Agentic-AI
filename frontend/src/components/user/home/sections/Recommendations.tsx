"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale } from "@/contexts/locale.context";
import { Heart } from "lucide-react";
import { spacing } from "@/theme/user";

interface RecommendationsProps {
  products: any[];
}

export function Recommendations({ products = [] }: RecommendationsProps) {
  const { t } = useLocale();
  const [visibleCount, setVisibleCount] = useState(8);
  const [isLazyLoading, setIsLazyLoading] = useState(false);

  const guessYouLike = products.slice(0, visibleCount);
  const hasMore = visibleCount < products.length;

  useEffect(() => {
    const handleScroll = () => {
      if (!hasMore || isLazyLoading) return;

      const threshold = 250;
      const totalHeight = document.documentElement.scrollHeight;
      const scrollPosition = window.innerHeight + window.scrollY;

      if (totalHeight - scrollPosition < threshold) {
        setIsLazyLoading(true);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMore, isLazyLoading]);

  useEffect(() => {
    if (isLazyLoading) {
      const timer = setTimeout(() => {
        setVisibleCount((prev) => Math.min(prev + 8, products.length));
        setIsLazyLoading(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isLazyLoading, products.length]);

  return (
    <section className={`max-w-7xl mx-auto ${spacing.layoutPx} py-4 ${spacing.sectionGap}`}>
      <div className="flex justify-center items-center gap-2 border-b pb-3.5">
        <h2 className="text-xl font-black text-slate-900 tracking-tight font-display">
          {t("guessYouLike")}
        </h2>
      </div>

      <div className={`grid grid-cols-2 md:grid-cols-4 ${spacing.gridGap}`}>
        {guessYouLike.map((product) => (
          <Link
            key={product.id}
            href={`/shop/${product.id}`}
            className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-3xs hover:shadow-md transition-all flex flex-col h-full text-left group hover:border-orange-200"
          >
            <div className="h-36 bg-slate-100 relative p-4 flex flex-col justify-between text-white overflow-hidden">
              {product.image ? (
                <>
                  <img 
                    src={product.image} 
                    alt={product.name} 
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 z-0"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent z-10" />
                </>
              ) : (
                <>
                  <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px] z-0" />
                  <div className="absolute inset-0 bg-slate-200 z-0" />
                </>
              )}
              
              <div className="flex justify-end items-center relative z-20">
                <div className="h-6 w-6 rounded-full bg-black/35 hover:bg-black/50 text-white flex items-center justify-center transition-colors">
                  <Heart className="size-3 text-white hover:text-rose-500" />
                </div>
              </div>
              
              <div className="flex flex-col gap-0.5 relative z-20 text-white">
                {!product.image && <span className="text-[8px] uppercase tracking-widest text-slate-400 font-bold">Image Placeholder</span>}
                <h3 className="font-extrabold text-xs line-clamp-1 leading-tight group-hover:scale-101 transition-transform origin-left text-white drop-shadow-md">
                  {product.name}
                </h3>
              </div>
            </div>

            <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
              <div className="space-y-1">
                <p className="text-[11px] text-slate-500 leading-normal line-clamp-2">
                  {product.description}
                </p>
                <div className="flex items-center gap-1 pt-1 select-none">
                  <span className="bg-orange-50 text-orange-600 text-[8px] font-extrabold px-1.5 py-0.2 rounded border border-orange-150">Hot</span>
                  <span className="bg-slate-50 text-slate-500 text-[8px] font-semibold px-1.5 py-0.2 rounded border">{t("freeShipping")}</span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                <span className="text-sm font-black text-orange-600">${product.price.toFixed(2)}</span>
                <span className="text-[9px] text-slate-400 font-bold">{t("positiveFeedback")}</span>
              </div>
            </div>
          </Link>
        ))}

        {isLazyLoading && Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`skeleton-${index}`}
            className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-3xs flex flex-col h-[278px] animate-pulse select-none"
          >
            <div className="h-36 bg-slate-200" />

            <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
              <div className="space-y-2">
                <div className="h-3.5 bg-slate-200 rounded-md w-16" />
                <div className="h-4 bg-slate-200 rounded-md w-5/6" />
                <div className="space-y-1 pt-1">
                  <div className="h-3 bg-slate-150 rounded w-full" />
                  <div className="h-3 bg-slate-150 rounded w-2/3" />
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                <div className="h-4 bg-orange-200 rounded w-12" />
                <div className="h-3 bg-slate-200 rounded w-10" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
