"use client";

import React, { use } from "react";
import { ClientLayout } from "@/components/user/layout/ClientLayout";
import { ReturnsTab } from "@/components/user/account/orders/tabs/ReturnsTab";
import { Breadcrumbs } from "@/components/user/layout/Breadcrumbs";
import { useLocale } from "@/contexts/locale.context";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function OrderReturnPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const orderId = decodeURIComponent(resolvedParams.id);
  const { locale } = useLocale();

  return (
    <ClientLayout>
      <div className="bg-[#f8fafc] min-h-screen pb-20 text-left">
        <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 space-y-6 text-left animate-in fade-in duration-300">

          {/* Breadcrumbs */}
          <div className="bg-[#f8fafc]/95 backdrop-blur-xs py-3 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 border-b border-slate-200/50 select-none mb-6">
            <Breadcrumbs
              className="mb-0"
              items={[
                { label: locale === "vi" ? "Tài khoản" : "Account", href: "/account?tab=profile" },
                { label: locale === "vi" ? "Đơn hàng" : "Orders", href: "/account?tab=orders" },
                { label: `Order ${orderId}`, href: `/account/orders/${encodeURIComponent(orderId)}` },
                { label: locale === "vi" ? "Đổi trả hàng" : "Return Request" }
              ]}
            />
          </div>

          {/* Back Shortcut */}
          <div className="mb-4">
            <Link
              href={`/account/orders/${encodeURIComponent(orderId)}`}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors font-bold"
            >
              <ArrowLeft className="size-3.5" />
              <span>{locale === "vi" ? "Quay lại chi tiết đơn hàng" : "Back to Order Details"}</span>
            </Link>
          </div>

          {/* Returns Tab Wrapper */}
          <ReturnsTab
            selectedOrderId={orderId}
            setSelectedOrderId={() => { }}
            isLocked={true}
          />

        </div>
      </div>
    </ClientLayout>
  );
}
