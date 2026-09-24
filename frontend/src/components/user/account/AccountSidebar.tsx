"use client";

import React from "react";
import { User, Package, Heart, LogOut } from "lucide-react";
import type { UserProfile } from "@/types/store";
import { colors } from "@/theme/user";

export interface AccountSidebarProps {
  currentUser: UserProfile | null;
  activeTab: "profile" | "orders" | "returns" | "return-requests";
  onTabChange: (tab: "profile" | "orders" | "returns" | "return-requests") => void;
  logout: () => void;
  locale: string;
  t: (key: any) => string;
}

export function AccountSidebar({
  currentUser,
  activeTab,
  onTabChange,
  logout,
  locale,
  t
}: AccountSidebarProps) {
  return (
    <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-6">
      
      {/* Profile Header */}
      <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
          {currentUser ? (
            <div className="h-full w-full rounded-full bg-linear-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white text-xs font-bold">
              {currentUser.first_name[0]}{currentUser.last_name[0]}
            </div>
          ) : (
            <User className="size-5" />
          )}
        </div>
        <div className="text-left leading-tight">
          <span className="font-extrabold text-sm text-slate-800 block">
            {currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : "Member Profile"}
          </span>
          <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
            {currentUser ? currentUser.email : "Manage your account"}
          </span>
        </div>
      </div>

      {/* Sidebar Navigation Links (State URL Switcher) */}
      <div className="flex flex-col gap-1.5">
        <a
          href="/account?tab=profile"
          onClick={(e) => {
            e.preventDefault();
            onTabChange("profile");
          }}
          className={`flex items-center gap-3 p-3 rounded-2xl text-xs font-black transition-all ${
            activeTab === "profile"
              ? `${colors.secondaryBg} text-white shadow-sm`
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <User className="size-4 stroke-[2]" />
          <span>{locale === "en" ? "Profile" : "Thông tin cá nhân"}</span>
        </a>
        
        <a
          href="/account?tab=orders"
          onClick={(e) => {
            e.preventDefault();
            onTabChange("orders");
          }}
          className={`flex items-center gap-3 p-3 rounded-2xl text-xs font-black transition-all ${
            activeTab === "orders"
              ? `${colors.secondaryBg} text-white shadow-sm`
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Package className="size-4 stroke-[2]" />
          <span>{locale === "en" ? "Orders" : "Đơn hàng của tôi"}</span>
        </a>

        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            alert("Favorites page is loading...");
          }}
          className="flex items-center gap-3 p-3 rounded-2xl text-xs font-black text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <Heart className="size-4 stroke-[2]" />
          <span>{locale === "en" ? "Favorites" : "Sản phẩm yêu thích"}</span>
        </a>
      </div>

      {/* Logged in Sign Out button */}
      {currentUser && (
        <button
          onClick={logout}
          className="w-full border border-rose-200 text-rose-600 hover:bg-rose-50 py-2.5 rounded-2xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <LogOut className="size-3.5" />
          <span>{locale === "en" ? "Sign Out" : "Đăng xuất"}</span>
        </button>
      )}

    </div>
  );
}
