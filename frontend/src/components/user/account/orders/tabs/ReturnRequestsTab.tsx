"use client";

import React from "react";
import { useAuth } from "@/features/auth/useAuth";
import { useReturns } from "@/features/returns/useReturns";
import { useLocale } from "@/contexts/locale.context";
import { spacing, colors } from "@/theme/user";
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  ArrowRight, 
  Calendar,
  MessageSquare,
  HelpCircle,
  FileText,
  DollarSign
} from "lucide-react";
import Link from "next/link";

export function ReturnRequestsTab() {
  const { currentUser } = useAuth();
  const { returnRequests } = useReturns();
  const { locale, t } = useLocale();

  const getPaymentMethodLabel = (paymentMethodId: string) => {
    if (!currentUser || !currentUser.payment_methods) {
      if (paymentMethodId.toLowerCase().includes("paypal")) {
        return "PayPal Account";
      }
      return paymentMethodId;
    }
    const pm = currentUser.payment_methods.find(
      (p: any) => p.id === paymentMethodId || p.paymentMethodId === paymentMethodId
    );
    if (!pm) {
      if (paymentMethodId.toLowerCase().includes("paypal")) {
        return "PayPal Account";
      }
      return paymentMethodId;
    }
    return pm.source === "paypal"
      ? "PayPal Account"
      : pm.source === "credit_card"
      ? `${pm.brand || "Credit Card"} Ending in ${pm.last_four || "XXXX"}`
      : "Gift Card";
  };

  const formatPrice = (amount: number) => {
    if (locale === "vi") {
      return (amount * 25000).toLocaleString("vi-VN") + " đ";
    }
    return `$${amount.toFixed(2)}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
            <CheckCircle2 className="size-3.5" />
            {locale === "vi" ? "Đã chấp thuận" : "Approved"}
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
            <XCircle className="size-3.5" />
            {locale === "vi" ? "Từ chối" : "Rejected"}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
            <Clock className="size-3.5 animate-pulse" />
            {locale === "vi" ? "Đang xử lý" : "Pending Approval"}
          </span>
        );
    }
  };

  const getTypeBadge = (type: string) => {
    if (type.toUpperCase() === "EXCHANGE") {
      return (
        <span className="bg-indigo-50 text-indigo-700 border border-indigo-150 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider">
          {locale === "vi" ? "Đổi hàng" : "Exchange"}
        </span>
      );
    }
    return (
      <span className="bg-orange-50 text-orange-700 border border-orange-150 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider">
        {locale === "vi" ? "Trả hàng" : "Return"}
      </span>
    );
  };

  const getReasonLabel = (reason: string) => {
    const reasonsMap: Record<string, { vi: string, en: string }> = {
      damaged_item: { vi: "Sản phẩm bị hỏng", en: "Damaged Item" },
      wrong_item: { vi: "Giao sai sản phẩm", en: "Incorrect Item Received" },
      size_mismatch: { vi: "Không vừa kích cỡ", en: "Size Mismatch" },
      not_as_described: { vi: "Không đúng mô tả", en: "Item Not As Described" },
      change_of_mind: { vi: "Đổi ý / Không muốn mua nữa", en: "Change of Mind" }
    };
    return reasonsMap[reason]?.[locale] || reason;
  };

  if (!returnRequests || returnRequests.length === 0) {
    return (
      <div className="bg-white border border-slate-200/60 rounded-3xl p-12 text-center space-y-4 shadow-sm animate-in fade-in duration-200">
        <div className="h-16 w-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 mx-auto border border-slate-100">
          <RotateCcw className="size-8 stroke-[1.5]" />
        </div>
        <h3 className="text-base font-black text-slate-800">
          {locale === "vi" ? "Không có yêu cầu đổi trả nào" : "No Return Claims Found"}
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed font-semibold">
          {locale === "vi"
            ? "Lịch sử đổi trả hàng của bạn hiện tại đang trống. Bạn có thể yêu cầu đổi trả bằng cách nhấn vào nút yêu cầu trên các đơn hàng đã nhận."
            : "Your return requests history is currently empty. You can file a claim for any delivered order inside your Orders history tab."}
        </p>
        <Link
          href="/account?tab=orders"
          className="inline-flex items-center gap-1.5 bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-slate-900 transition-colors"
        >
          <span>{locale === "vi" ? "Xem đơn hàng" : "Go to Orders"}</span>
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300">
      
      {/* Tab Title */}
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
        <h2 className="text-lg font-black text-slate-800 font-display">
          {locale === "vi" ? "Yêu cầu Đổi trả hàng" : "Return & Exchange Claims"}
        </h2>
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
          {returnRequests.length} {locale === "vi" ? "yêu cầu" : "requests"}
        </span>
      </div>

      <div className="space-y-5">
        {returnRequests.map((req) => (
          <div 
            key={req.id} 
            className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-4 hover:border-slate-300/80 transition-colors"
          >
            
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-extrabold text-slate-800 font-mono">
                    {req.returnId}
                  </span>
                  {getTypeBadge(req.type)}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold select-none">
                  <Calendar className="size-3.5" />
                  <span>{req.createdAt?.replace("T", " ") || "2026-08-07 12:00"}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[10px] text-slate-400 font-bold">
                  {locale === "vi" ? "Đơn hàng:" : "Order:"}{" "}
                  <Link 
                    href={`/account/orders/${encodeURIComponent(req.orderId)}`}
                    className="font-mono text-[#ff4e20] font-bold hover:underline"
                  >
                    {req.orderId}
                  </Link>
                </span>
                {getStatusBadge(req.status)}
              </div>
            </div>

            {/* List of items being returned */}
            <div className="space-y-3.5">
              <div className="divide-y divide-slate-100">
                {req.items.map((item, itemIdx) => (
                  <div key={item.itemId || itemIdx} className="py-3 first:pt-0 last:pb-0 flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                      <Package className="size-5 stroke-[1.5]" />
                    </div>
                    
                    <div className="flex-1 text-left space-y-1">
                      <h4 className="text-xs font-extrabold text-slate-800 leading-tight">
                        {item.name}
                      </h4>
                      <div className="text-[10px] text-slate-400 font-semibold space-y-0.5">
                        <p className="text-slate-500 flex items-center gap-1">
                          <HelpCircle className="size-3 text-slate-400" />
                          <span>{locale === "vi" ? "Lý do:" : "Reason:"} {getReasonLabel(item.reason)}</span>
                        </p>
                      </div>

                      {item.customerComment && (
                        <div className="bg-slate-50 border border-slate-100/80 rounded-xl p-2.5 mt-2 flex items-start gap-2 max-w-xl">
                          <MessageSquare className="size-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic">
                            &ldquo;{item.customerComment}&rdquo;
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="block text-xs font-black text-slate-850">
                        {formatPrice(item.price)}
                      </span>
                      <span className="block text-[10px] text-slate-400 font-bold mt-0.5">
                        Qty: {item.quantity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Refund & Destination Payment Details */}
            {req.type === "RETURN" && req.paymentMethodId && (
              <div className="bg-slate-50/50 border border-slate-200/60 rounded-2xl p-3.5 flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-400 font-bold">{locale === "vi" ? "Phương thức hoàn tiền:" : "Refund Destination:"}</span>
                <span className="font-sans text-slate-700 font-bold bg-slate-100 px-2 py-0.5 rounded-md">
                  {getPaymentMethodLabel(req.paymentMethodId)}
                </span>
              </div>
            )}

          </div>
        ))}
      </div>

    </div>
  );
}
