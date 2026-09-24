"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "@/contexts/locale.context";
import { Search, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { spacing, colors } from "@/theme/user";

export function SearchArea() {
  const router = useRouter();
  const { locale, t } = useLocale();
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const [searchTab, setSearchTab] = useState<"baby" | "shop">("baby");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (localSearchQuery.trim()) {
      router.push(`/shop?query=${encodeURIComponent(localSearchQuery)}`);
    } else {
      router.push("/shop");
    }
  };

  return (
    <section className="bg-white py-6">
      <div className={`max-w-7xl mx-auto ${spacing.layoutPx} grid grid-cols-12 gap-4 items-center`}>
        <div className="col-span-12 md:col-span-3 flex justify-center md:justify-start items-center gap-3">
          <div className={`h-12 w-12 rounded-xl ${colors.primaryBg} flex items-center justify-center text-white font-black text-2xl shadow-premium shadow-orange-600/10`}>
            LK
          </div>
          <div className="text-left">
            <span className={`block font-black text-2xl tracking-tight ${colors.primaryText} font-display`}>
              Laki Shop
            </span>
          </div>
        </div>

        <div className="col-span-12 md:col-span-6 space-y-1.5 w-full">
          <div className="flex gap-4 pl-4 text-sm select-none">
            <button
              onClick={() => setSearchTab("baby")}
              className={`font-extrabold pb-0.5 transition-all cursor-pointer ${searchTab === "baby" ? "text-orange-600 border-b-2 border-orange-600 scale-105" : "text-slate-500 hover:text-orange-600"}`}
            >
              {t("baby")}
            </button>
            <button
              onClick={() => setSearchTab("shop")}
              className={`font-extrabold pb-0.5 transition-all cursor-pointer ${searchTab === "shop" ? "text-orange-600 border-b-2 border-orange-600 scale-105" : "text-slate-500 hover:text-orange-600"}`}
            >
              {t("shop")}
            </button>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex border-3 border-orange-600 rounded-full overflow-hidden bg-white shadow-premium shadow-orange-600/5 focus-within:ring-2 focus-within:ring-orange-100 transition-all">
            <div className="relative flex-grow flex items-center pl-4 bg-white">
              <Search className="size-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder={searchTab === "baby" ? t("searchPlaceholder") : "Enter shop name..."}
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
                className="w-full bg-white text-sm border-0 outline-none pl-2 py-3 text-slate-800 font-medium placeholder:text-slate-400"
              />
            </div>
            <button
              type="submit"
              className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold px-8 py-3 shrink-0 transition-colors cursor-pointer"
            >
              {t("searchButton")}
            </button>
          </form>
        </div>

        <div className="col-span-12 md:col-span-3 hidden md:flex justify-end">
          <button
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              window.dispatchEvent(new CustomEvent("open-store-chat", {
                detail: {
                  x: rect.left + rect.width / 2,
                  y: rect.top + rect.height / 2
                }
              }));
            }}
            className="flex items-center gap-1 max-w-[280px] text-left cursor-pointer group transition-all active:scale-98 select-none border-none bg-transparent p-0 relative"
          >
            <div className="relative bg-linear-to-r from-orange-500 to-orange-600 rounded-2xl p-2.5 px-3.5 shadow-md shadow-orange-600/10 text-left max-w-[185px] group-hover:shadow-lg group-hover:shadow-orange-600/20 transition-all mr-1 border-0">
              <span className="block text-[11px] font-black text-white leading-tight">
                {locale === "en" ? "Your Shopping Assistant" : "Trợ lý mua sắm của bạn"}
              </span>
              <span className="block text-[9px] text-orange-100 leading-none mt-1 font-bold">
                {locale === "en" ? "24/7 Agent Support" : "Hỗ trợ trực tuyến 24/7"}
              </span>
              <div className="absolute top-1/2 -translate-y-1/2 left-full w-0 h-0 border-y-[6px] border-y-transparent border-l-[6px] border-l-orange-600" />
            </div>

            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
              className="shrink-0 relative"
            >
              <img
                src="/taobao_mascot.png"
                alt="AI Assistant"
                className="h-20 w-20 object-contain group-hover:scale-105 transition-transform duration-200"
              />
              <span className="absolute top-1.5 right-2 flex h-2.5 w-2.5 select-none">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-white"></span>
              </span>
            </motion.div>
          </button>
        </div>
      </div>
    </section>
  );
}
