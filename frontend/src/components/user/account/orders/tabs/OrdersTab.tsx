import React, { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/features/auth/useAuth";
import { useOrders } from "@/features/orders/useOrders";
import { useReturns } from "@/features/returns/useReturns";
import { useLocale } from "@/contexts/locale.context";
import { spacing, colors } from "@/theme/user";
import { 
  Package, 
  Clock, 
  ChevronUp, 
  ChevronDown, 
  Truck, 
  DollarSign, 
  RotateCcw,
  Eye
} from "lucide-react";
import Link from "next/link";
import { ReturnRequestsTab } from "./ReturnRequestsTab";

export const getProductImage = (name: string) => {
  const lowercaseName = (name || "").toLowerCase();
  if (lowercaseName.includes("earbuds") || lowercaseName.includes("tai nghe")) {
    return "https://m.media-amazon.com/images/I/61XX6o+BuYL._AC_SX679_.jpg";
  }
  if (lowercaseName.includes("chair") || lowercaseName.includes("ghế")) {
    return "https://m.media-amazon.com/images/I/81bme5O8utL._AC_SX679_.jpg";
  }
  if (lowercaseName.includes("bulb") || lowercaseName.includes("bóng đèn")) {
    return "https://m.media-amazon.com/images/I/71cGQUUmPaL._AC_SY879_.jpg";
  }
  if (lowercaseName.includes("keyboard") || lowercaseName.includes("bàn phím")) {
    return "https://m.media-amazon.com/images/I/61z1DHhxmuL._AC_SY879_.jpg";
  }
  if (lowercaseName.includes("watch") || lowercaseName.includes("đồng hồ")) {
    return "https://m.media-amazon.com/images/I/71Q6T+0GkXL._AC_SX679_.jpg";
  }
  if (lowercaseName.includes("camera") || lowercaseName.includes("máy ảnh")) {
    return "https://m.media-amazon.com/images/I/61uVOVwEFOL._AC_SY879_.jpg";
  }
  if (lowercaseName.includes("skateboard") || lowercaseName.includes("ván trượt")) {
    return "https://m.media-amazon.com/images/I/71ttLS8uEmL._AC_SY879_.jpg";
  }
  if (lowercaseName.includes("hose") || lowercaseName.includes("vòi nước")) {
    return "https://m.media-amazon.com/images/I/81sgxaMJNJL._AC_SX679_.jpg";
  }
  return "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&auto=format&fit=crop&q=60";
};

export interface OrdersTabProps {
  onRequestReturn: (orderId: string) => void;
}

export function OrdersTab({ onRequestReturn }: OrdersTabProps) {
  const { currentUser } = useAuth();
  const { orders } = useOrders();
  const { returnRequests } = useReturns();
  const { locale, t } = useLocale();
  const searchParams = useSearchParams();
  const subTabParam = searchParams.get("subTab");
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [activeSubTab, setActiveSubTab] = useState<"all" | "pending" | "shipping" | "delivered" | "returns" | "cancelled">(
    (subTabParam === "returns") ? "returns" : "all"
  );

  const filteredOrders = orders.filter((order) => {
    const status = order.status.toLowerCase();
    switch (activeSubTab) {
      case "pending":
        return status === "pending";
      case "shipping":
        return status === "processed";
      case "delivered":
        return status === "delivered";
      case "returns":
        const hasReq = (returnRequests || []).some(
          (req) => req.orderId === order.order_id
        );
        return hasReq || status === "return requested" || status === "exchange requested";
      case "cancelled":
        return status === "cancelled";
      case "all":
      default:
        return true;
    }
  });

  const formatPrice = (amount: number) => {
    if (locale === "vi") {
      return (amount * 25000).toLocaleString("vi-VN") + " đ";
    }
    return `$${amount.toFixed(2)}`;
  };

  if (!currentUser) {
    return (
      <div className={`bg-white border border-slate-200/60 rounded-3xl ${spacing.cardPadding} shadow-sm text-center ${spacing.sectionGap} animate-in zoom-in-98 duration-200`}>
        <div className="space-y-2">
          <div className="h-14 w-14 rounded-2xl bg-orange-50 flex items-center justify-center text-[#ff4e20] mx-auto shadow-3xs">
            <Package className="size-6 stroke-[2]" />
          </div>
          <h1 className="text-xl font-black text-slate-900 font-display">
            {t("signInToViewOrders")}
          </h1>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            {t("signInToViewOrdersDesc")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-slate-200/60 rounded-3xl ${spacing.cardPadding} shadow-sm ${spacing.sectionGap} text-left animate-in fade-in duration-350`}>
      
      <div className="space-y-1">
        <h2 className="text-xl font-black text-slate-900 font-display">
          {t("orderHistory")}
        </h2>
        <p className="text-xs text-slate-500 font-medium">
          {t("ordersDesc")}
        </p>
      </div>

      {/* Sub-tabs Filter Nav */}
      <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-4 select-none">
        {(["all", "pending", "shipping", "delivered", "returns", "cancelled"] as const).map((tabKey) => {
          const isActive = activeSubTab === tabKey;
          const getLabel = () => {
            switch (tabKey) {
              case "all":
                return locale === "vi" ? "Tất cả" : "All";
              case "pending":
                return locale === "vi" ? "Chờ xử lý" : "Pending";
              case "shipping":
                return locale === "vi" ? "Đang giao" : "Shipping";
              case "delivered":
                return locale === "vi" ? "Đã giao" : "Delivered";
              case "returns":
                return locale === "vi" ? "Trả hàng" : "Returns";
              case "cancelled":
                return locale === "vi" ? "Đã hủy" : "Cancelled";
            }
          };
          
          return (
            <button
              key={tabKey}
              type="button"
              onClick={() => setActiveSubTab(tabKey)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer select-none ${
                isActive 
                  ? "bg-slate-900 border-slate-900 text-white font-extrabold shadow-sm" 
                  : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              }`}
            >
              {getLabel()}
            </button>
          );
        })}
      </div>

      <div className="space-y-6">
        {activeSubTab === "returns" ? (
          <ReturnRequestsTab />
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs font-medium border border-dashed rounded-2xl select-none">
            {locale === "vi" ? "Không tìm thấy đơn hàng nào trong mục này." : "No orders found in this category."}
          </div>
        ) : (
          filteredOrders.map((order) => {
            const ordId = order.order_id;
            const isExpanded = !!expandedItems[ordId];
            const itemsToShow = (order.items.length <= 1 || isExpanded)
              ? order.items
              : [order.items[0]];

            return (
              <div
                key={ordId}
                className="border border-slate-200 rounded-2xl bg-white p-5 space-y-4 shadow-3xs hover:border-slate-300 transition-colors"
              >
                
                {/* Order ID, Date, Status, Total */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100 select-none">
                  <div className="flex items-center gap-3">
                    <div className="leading-tight text-left">
                      <p className="font-mono font-bold text-xs text-slate-800">{order.order_id}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 justify-between sm:justify-end">
                    <div className="text-right leading-tight">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">{locale === "vi" ? "Tổng tiền" : "Total Amount"}</span>
                      <span className={`text-xs font-extrabold ${colors.primaryText}`}>{formatPrice(order.total)}</span>
                    </div>
                    <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border select-none ${
                      order.status === "delivered"
                        ? `${colors.successBg} ${colors.successBorder} ${colors.successText}`
                        : order.status === "cancelled"
                        ? `${colors.dangerBg} ${colors.dangerBorder} ${colors.dangerText}`
                        : `${colors.warningBg} ${colors.warningBorder} ${colors.warningText}`
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>

                {/* Display Products List directly */}
                <div className="space-y-3.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block text-left">{t("productList")}</span>
                  <div className="divide-y divide-slate-100 border-t border-b text-xs font-semibold">
                    {itemsToShow.map((item, itemIdx) => (
                      <div key={item.item_id || itemIdx} className="py-3 flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* Product Image */}
                          {getProductImage(item.name) ? (
                            <div className="h-12 w-12 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden shrink-0 select-none">
                              <img 
                                src={getProductImage(item.name)} 
                                alt={item.name} 
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="h-12 w-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-package size-5 stroke-[1.5]">
                                <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"></path>
                                <path d="M12 22V12"></path>
                                <polyline points="3.29 7 12 12 20.71 7"></polyline>
                                <path d="m7.5 4.27 9 5.15"></path>
                              </svg>
                            </div>
                          )}
                          <div className="space-y-1 text-left min-w-0 flex-1">
                            <p className="font-extrabold text-slate-800 text-[13px] truncate">{item.name}</p>
                            {item.options && Object.keys(item.options).length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-1.5 select-none">
                                {Object.entries(item.options).map(([k, v]) => (
                                  <span key={k} className="bg-slate-50 text-slate-500 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold">
                                    {k === "Phân loại" ? (locale === "vi" ? "Phân loại" : "Option") : k}: {v}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-slate-800 block">{formatPrice(item.price)}</span>
                          <span className="text-[10px] text-slate-400 block font-semibold mt-0.5">{locale === "vi" ? "SL: 1" : "Qty: 1"}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* View More / View Less Toggle Button */}
                  {order.items.length > 1 && (
                    <div className="flex justify-start">
                      {!isExpanded ? (
                        <button
                          onClick={() => setExpandedItems(prev => ({ ...prev, [order.order_id]: true }))}
                          className="flex items-center gap-1 text-xs text-orange-655 hover:text-orange-700 font-extrabold cursor-pointer select-none"
                        >
                          <span>{locale === "vi" ? `Xem thêm ${order.items.length - 1} sản phẩm` : `View ${order.items.length - 1} more items`}</span>
                          <ChevronDown className="size-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setExpandedItems(prev => ({ ...prev, [order.order_id]: false }))}
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-650 font-semibold cursor-pointer select-none"
                        >
                          <span>{t("showLess")}</span>
                          <ChevronUp className="size-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Shipping / Fulfillment Tracking */}
                {order.fulfillments && order.fulfillments.length > 0 && (
                  <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs font-semibold text-left">
                    <div className="flex items-center gap-2 text-slate-800 border-b pb-1.5 border-slate-200/60 select-none">
                      <Truck className="size-4 text-[#ff4e20]" />
                      <span className="font-bold text-[11px] uppercase tracking-wider">{t("shippingInfo")}</span>
                    </div>
                    {order.fulfillments.map((ful, fIdx) => (
                      <div key={fIdx} className="space-y-1 text-slate-600 leading-normal">
                        <p>
                          <span className="text-slate-400 font-medium">{t("trackingId")}</span>{" "}
                          <span className="font-mono text-slate-800 font-bold select-all">{ful.tracking_id.join(", ")}</span>
                        </p>
                        <p>
                          <span className="text-slate-400 font-medium">{t("shippingCarrier")}</span>{" "}
                          <span className="text-slate-800 font-bold">Laki Standard Delivery</span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Payment History */}
                {order.payment_history && order.payment_history.length > 0 && (
                  <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs font-semibold text-left">
                    <div className="flex items-center gap-2 text-slate-800 border-b pb-1.5 border-slate-200/60 select-none">
                      <DollarSign className="size-4 text-[#ff4e20]" />
                      <span className="font-bold text-[11px] uppercase tracking-wider">{t("paymentHistory")}</span>
                    </div>
                    {order.payment_history.map((pay, pIdx) => (
                      <div key={pIdx} className="flex justify-between items-center text-slate-600 font-semibold">
                        <div>
                          <span className="text-slate-800 font-bold capitalize">{pay.transaction_type}</span>{" "}
                          <span className="text-slate-400 font-medium font-mono text-[10px]">({pay.payment_method_id})</span>
                        </div>
                        <span className="text-xs font-bold text-slate-800">{formatPrice(pay.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action shortcuts */}
                <div className="flex justify-between items-center pt-3 border-t border-slate-100/60">
                  <Link
                    href={`/account/orders/${encodeURIComponent(order.order_id)}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    <Eye className="size-4" />
                    <span>{locale === "vi" ? "Xem chi tiết" : "View Details"}</span>
                  </Link>
                </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
