"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";

import { ClientLayout } from "@/components/user/layout/ClientLayout";
import { Breadcrumbs } from "@/components/user/layout/Breadcrumbs";
import { useAuth } from "@/features/auth/useAuth";
import { useLocale } from "@/contexts/locale.context";
import { spacing, zIndex } from "@/theme/user";

import { ProfileTab } from "./orders/tabs/ProfileTab";
import { OrdersTab } from "./orders/tabs/OrdersTab";
import { ReturnRequestsTab } from "./orders/tabs/ReturnRequestsTab";
import { AccountSidebar } from "./AccountSidebar";

export default function AccountDashboard() {
  const { currentUser, logout, isInitialized } = useAuth();
  const { locale, t } = useLocale();
  const router = useRouter();

  // Guard routing - redirect to /login if authentication has finished loading and user is unauthenticated
  useEffect(() => {
    if (isInitialized && !currentUser) {
      router.push("/login");
    }
  }, [isInitialized, currentUser, router]);

  // Tab state bound to query parameters using useQueryState
  const [tab, setTab] = useQueryState("tab");
  const activeTab = (tab === "orders" || tab === "returns" || tab === "return-requests") ? tab : "profile";

  const handleTabChange = (newTab: "profile" | "orders" | "returns" | "return-requests") => {
    setTab(newTab === "profile" ? null : newTab);
  };

  const handleRequestReturn = (orderId: string) => {
    router.push(`/account/orders/${encodeURIComponent(orderId)}/returns`);
  };

  const getBreadcrumbsItems = () => {
    if (activeTab === "orders") {
      return [{ label: locale === "en" ? "Orders" : "Đơn hàng của tôi" }];
    }
    if (activeTab === "returns") {
      return [
        { label: locale === "vi" ? "Hồ sơ cá nhân" : "Member Profile", href: "/account?tab=profile" },
        { label: locale === "vi" ? "Yêu cầu trả hàng & hoàn tiền" : "Returns & Refunds" }
      ];
    }
    return [{ label: locale === "en" ? "Profile" : "Thông tin cá nhân" }];
  };

  return (
    <ClientLayout>
      <div className="bg-[#f8fafc] min-h-screen pb-20 text-left">
        <div className={`max-w-7xl w-full mx-auto ${spacing.layoutPadding} ${spacing.sectionGap} text-left animate-in fade-in duration-300`}>

          {/* Breadcrumbs */}
          <div className={`sticky ${spacing.stickyHeaderOffset} ${zIndex.breadcrumbs} bg-[#f8fafc]/95 backdrop-blur-xs py-3 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 border-b border-slate-200/50 select-none`}>
            <Breadcrumbs
              className="mb-0"
              items={getBreadcrumbsItems()}
            />
          </div>

          {/* Three-Column Layout Grid */}
          <div className={`grid grid-cols-1 lg:grid-cols-12 ${spacing.gridGap} items-start`}>

            {/* COLUMN 1: LEFT SIDEBAR NAVIGATION */}
            <div className={`lg:col-span-3 flex flex-col gap-6 lg:sticky ${spacing.stickySidebarOffset} select-none`}>
              <AccountSidebar
                currentUser={currentUser}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                logout={logout}
                locale={locale}
                t={t}
              />
            </div>

            {/* COLUMN 2: CENTER PANEL */}
            <div className="lg:col-span-9 flex flex-col gap-6">
              {activeTab === "profile" && (
                <ProfileTab onTabChange={handleTabChange} />
              )}
              {activeTab === "orders" && (
                <OrdersTab onRequestReturn={handleRequestReturn} />
              )}
              {activeTab === "returns" && (
                <div className="bg-white border border-slate-200/60 rounded-3xl p-8 text-center space-y-4 shadow-sm animate-in zoom-in-98 duration-200">
                  <div className="h-14 w-14 rounded-2xl bg-orange-50 flex items-center justify-center text-[#ff4e20] mx-auto shadow-3xs">
                    <RotateCcw className="size-6 stroke-[2]" />
                  </div>
                  <h1 className="text-xl font-black text-slate-900 font-display">
                    {locale === "vi" ? "Đổi trả hàng & Hoàn tiền" : "Returns & Refunds"}
                  </h1>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed font-semibold">
                    {locale === "vi"
                      ? "Để yêu cầu đổi trả hàng hoặc hoàn tiền, vui lòng chọn một đơn hàng đã mua trong danh sách Đơn hàng của tôi."
                      : "To request a return or refund, please select an order from your purchase history."}
                  </p>
                  <button
                    onClick={() => handleTabChange("orders")}
                    className="bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-slate-900 transition-colors cursor-pointer border-none"
                  >
                    {locale === "vi" ? "Xem đơn hàng của tôi" : "View My Orders"}
                  </button>
                </div>
              )}
              {activeTab === "return-requests" && (
                <ReturnRequestsTab />
              )}
            </div>

          </div>
        </div>
      </div>
    </ClientLayout>
  );
}
