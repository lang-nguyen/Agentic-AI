"use client";

import React from "react";
import Link from "next/link";
import { useLocale } from "@/contexts/locale.context";
import { spacing } from "@/theme/user";

interface DoubleFeaturesProps {
  products: any[];
}

export function DoubleFeatures({ products = [] }: DoubleFeaturesProps) {
  const { t } = useLocale();
  const goodGoods = products.slice(4, 6);
  const specialDeals = products.slice(1, 3);

  return (
    <section className={`max-w-7xl mx-auto ${spacing.layoutPx} py-4 select-none`}>
      <div className={`grid grid-cols-1 md:grid-cols-2 ${spacing.gridGap} text-left`}>
        <div className={`bg-white border border-slate-200 rounded-3xl ${spacing.cardPadding} shadow-3xs ${spacing.elementGap}`}>
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-1.5">
              <div className="bg-orange-600 text-white rounded-full p-1 text-xs">👍</div>
              <h3 className="font-extrabold text-sm text-slate-850">{t("goodGoods")}</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Fine items catalog</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {goodGoods.map((prod) => (
              <Link
                key={prod.id}
                href={`/shop/${prod.id}`}
                className="flex gap-3 items-center group hover:bg-slate-50 p-2 rounded-xl border border-transparent hover:border-slate-200 transition-all"
              >
                {prod.image ? (
                  <img src={prod.image} alt={prod.name} className="h-14 w-14 rounded-lg shrink-0 object-cover border" />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-slate-200 shrink-0 text-[8px] flex items-center justify-center text-slate-400 font-bold select-none border">
                    IMAGE
                  </div>
                )}
                <div className="space-y-0.5 truncate">
                  <h4 className="font-bold text-xs text-slate-850 truncate group-hover:text-orange-600">{prod.name}</h4>
                  <span className="text-xs font-black text-orange-600">${prod.price}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className={`bg-white border border-slate-200 rounded-3xl ${spacing.cardPadding} shadow-3xs ${spacing.elementGap}`}>
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-1.5">
              <div className="bg-rose-500 text-white rounded-full p-1 text-xs">🔥</div>
              <h3 className="font-extrabold text-sm text-slate-850">{t("dailyDeals")}</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">{t("dealsDescription")}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {specialDeals.map((prod, idx) => (
              <Link
                key={prod.id}
                href={`/shop/${prod.id}`}
                className="flex flex-col justify-between group hover:bg-slate-50 p-2.5 rounded-xl border border-transparent hover:border-slate-200 transition-all space-y-2"
              >
                <div className="flex gap-2.5 items-center">
                  {prod.image ? (
                    <img src={prod.image} alt={prod.name} className="h-10 w-10 rounded-lg shrink-0 object-cover border" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-slate-200 shrink-0 text-[8px] flex items-center justify-center text-slate-400 font-bold select-none border">
                      IMAGE
                    </div>
                  )}
                  <div className="space-y-0.5 truncate">
                    <h4 className="font-bold text-xs text-slate-850 truncate group-hover:text-orange-600">{prod.name}</h4>
                    <span className="text-xs font-black text-rose-600">${prod.price}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[8px] font-bold text-slate-400">
                    <span>Sold {idx === 0 ? "68%" : "82%"}</span>
                    <span>{idx === 0 ? "12 left" : "4 left"}</span>
                  </div>
                  <div className="h-1 bg-slate-100 rounded-full overflow-hidden border">
                    <div
                      className="h-full bg-rose-500 rounded-full"
                      style={{ width: idx === 0 ? "68%" : "82%" }}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
