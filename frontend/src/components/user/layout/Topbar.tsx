"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/useAuth";
import { useLocale } from "@/contexts/locale.context";
import { Package, ShoppingBag, HelpCircle } from "lucide-react";
import { spacing } from "@/theme/user";

export function Topbar() {
  const { currentUser, logout } = useAuth();
  const { t } = useLocale();

  return (
    <div className="bg-slate-100 border-b border-slate-200 text-[11px] text-slate-500 py-1.5 select-none">
      <div className={`max-w-7xl mx-auto ${spacing.layoutPx} flex justify-between items-center`}>
        <div className="flex items-center gap-3">
          {currentUser ? (
            <>
              <span className="text-slate-800 font-bold">Hi, {currentUser.first_name} {currentUser.last_name}</span>
              <button onClick={logout} className="hover:text-orange-600 font-semibold cursor-pointer">{t("signOut")}</button>
            </>
          ) : (
            <>
              <span className="text-slate-400">{t("welcome")}</span>
              <Link href="/account" className="text-orange-600 hover:underline font-bold">{t("pleaseLogIn")}</Link>
              <Link href="/account" className="hover:text-orange-600 font-medium">{t("freeRegistration")}</Link>
            </>
          )}
          <span className="text-slate-300">|</span>
          <span className="hidden sm:inline hover:text-orange-600 cursor-pointer">{t("mobileVersion")}</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/shop" className="hover:text-orange-600">{t("productCenter")}</Link>
          <Link href="/orders" className="hover:text-orange-600 flex items-center gap-0.5">
            <Package className="size-3 text-slate-400" />
            <span>{t("myOrders")}</span>
          </Link>
          <Link href="/account" className="hover:text-orange-600 flex items-center gap-0.5">
            <ShoppingBag className="size-3 text-slate-400" />
            <span>{t("shoppingCart")}</span>
          </Link>
          <span className="text-slate-300">|</span>
          <span className="hover:text-orange-600 cursor-pointer hidden md:inline">{t("sellerCenter")}</span>
          <span className="hover:text-orange-600 cursor-pointer flex items-center gap-0.5">
            <HelpCircle className="size-3 text-slate-400" />
            <span>{t("customerService")}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
