"use client";

import React, { use, useState } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { useOrders } from "@/features/orders/useOrders";
import { useLocale } from "@/contexts/locale.context";
import { ClientLayout } from "@/components/user/layout/ClientLayout";
import { Breadcrumbs } from "@/components/user/layout/Breadcrumbs";
import { spacing, colors } from "@/theme/user";
import { 
  Package, 
  Clock, 
  MapPin, 
  CreditCard, 
  ArrowLeft, 
  Truck, 
  ShieldCheck, 
  Info,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { API_CONFIG } from "@/config/api";

interface PageProps {
  params: Promise<{ id: string }>;
}

const getProductImage = (name: string) => {
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

export default function OrderDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const orderId = decodeURIComponent(resolvedParams.id);
  
  const { currentUser } = useAuth();
  const { orders } = useOrders();
  const { locale, t } = useLocale();
  const [trackings, setTrackings] = useState<any[]>([]);
  const [isLoadingTracking, setIsLoadingTracking] = useState<boolean>(true);

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

  // Find order in our live state
  const order = orders.find((o) => o.order_id === orderId);

  useEffect(() => {
    const fetchTracking = async () => {
      try {
        setIsLoadingTracking(true);
        const token = localStorage.getItem("store:token");
        const res = await fetch(`${API_CONFIG.webBackendBaseUrl}/api/order-trackings/${encodeURIComponent(orderId)}`, {
          headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error("Failed to fetch tracking info");
        const data = await res.json();
        const sortedData = (data || []).sort((a: any, b: any) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        setTrackings(sortedData);
      } catch (err) {
        console.error("Error fetching order tracking info:", err);
      } finally {
        setIsLoadingTracking(false);
      }
    };

    fetchTracking();
  }, [orderId]);

  const formatPrice = (amount: number) => {
    if (locale === "vi") {
      return (amount * 25000).toLocaleString("vi-VN") + " đ";
    }
    return `$${amount.toFixed(2)}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "delivered":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
            <CheckCircle className="size-3.5 fill-emerald-100" />
            {locale === "vi" ? "Đã giao hàng" : "Delivered"}
          </span>
        );
      case "processed":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
            <Package className="size-3.5 fill-blue-100" />
            {locale === "vi" ? "Đang xử lý" : "Processed"}
          </span>
        );
      case "return requested":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
            <AlertTriangle className="size-3.5 fill-amber-100" />
            {locale === "vi" ? "Yêu cầu trả hàng" : "Return Requested"}
          </span>
        );
      case "exchange requested":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
            <AlertTriangle className="size-3.5 fill-indigo-100" />
            {locale === "vi" ? "Yêu cầu đổi hàng" : "Exchange Requested"}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-slate-50 text-slate-700 border border-slate-200 uppercase tracking-wider">
            <Clock className="size-3.5" />
            {locale === "vi" ? "Đang chờ" : "Pending"}
          </span>
        );
    }
  };

  const getTimelineSteps = (status: string) => {
    const s = status.toLowerCase();
    
    // Determine which step is currently active
    let activeKey = "created";
    if (s === "delivered") {
      activeKey = "delivered";
    } else if (s === "processed") {
      activeKey = "processed";
    } else if (s === "pending") {
      // If there is payment history, we mark it as "paid"
      activeKey = (order && order.payment_history && order.payment_history.length > 0) ? "paid" : "created";
    } else if (s === "return requested" || s === "exchange requested") {
      activeKey = "delivered"; // It was delivered, now returned
    }

    const steps = [
      { key: "created", labelEn: "Created", labelVi: "Đã tạo đơn", isActive: activeKey === "created" },
      { key: "paid", labelEn: "Paid", labelVi: "Đã thanh toán", isActive: activeKey === "paid" },
      { key: "processed", labelEn: "Processing", labelVi: "Đang xử lý", isActive: activeKey === "processed" },
      { key: "delivered", labelEn: "Delivered", labelVi: "Đã giao hàng", isActive: activeKey === "delivered" }
    ];
    return steps;
  };

  if (!order) {
    return (
      <ClientLayout>
        <div className="bg-[#f8fafc] min-h-screen py-16 text-center">
          <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 mx-auto">
              <Package className="size-6" />
            </div>
            <h1 className="text-lg font-black text-slate-800">
              {locale === "vi" ? "Không tìm thấy đơn hàng" : "Order Not Found"}
            </h1>
            <p className="text-xs text-slate-500">
              {locale === "vi" ? `Không tìm thấy thông tin của đơn hàng #${orderId} trong hệ thống.` : `We couldn't find order #${orderId} in our system.`}
            </p>
            <Link
              href="/account?tab=orders"
              className="inline-flex items-center gap-2 bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-slate-900 transition-colors"
            >
              <ArrowLeft className="size-4" />
              <span>{locale === "vi" ? "Quay lại danh sách" : "Back to Orders"}</span>
            </Link>
          </div>
        </div>
      </ClientLayout>
    );
  }

  const timelineSteps = getTimelineSteps(order.status);

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
                { label: `Order ${order.order_id}` }
              ]}
            />
          </div>

          {/* Action Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="space-y-1">
              <Link 
                href="/account?tab=orders"
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors font-bold mb-1"
              >
                <ArrowLeft className="size-3.5" />
                <span>{locale === "vi" ? "Quay lại Đơn hàng" : "Back to Orders"}</span>
              </Link>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-black text-slate-800 font-display">
                  {locale === "vi" ? "Chi tiết Đơn hàng" : "Order Details"} <span className="font-mono text-slate-500 font-bold">{order.order_id}</span>
                </h1>
                {getStatusBadge(order.status)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            
            {/* COLUMN 1 & 2: Order items details */}
            <div className="md:col-span-2 space-y-6">
              
              {/* Status Timeline Card */}
              <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-6">
                  {locale === "vi" ? "Trạng thái vận chuyển" : "Delivery Tracking Status"}
                </h3>
                <div className="flex items-center justify-between relative">
                  {/* Timeline connectors */}
                  <div className="absolute left-4 right-4 top-3.5 h-0.5 bg-slate-100 -z-10" />
                  
                  {timelineSteps.map((step, idx) => (
                    <div 
                      key={step.key} 
                      className={`flex flex-col items-center gap-2 flex-1 text-center transition-all duration-300 ${
                        step.isActive 
                          ? "opacity-100 scale-105" 
                          : "opacity-40"
                      }`}
                    >
                      <div className={`h-8 w-8 rounded-full border flex items-center justify-center font-bold text-xs transition-all ${
                        step.isActive 
                          ? "bg-orange-500 border-orange-500 text-white shadow-md ring-4 ring-orange-100/80" 
                          : "bg-white border-slate-200 text-slate-400"
                      }`}>
                        {idx + 1}
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-wider ${
                        step.isActive ? "text-slate-800" : "text-slate-400"
                      }`}>
                        {locale === "vi" ? step.labelVi : step.labelEn}
                      </span>
                    </div>
                  ))}
                </div>
              </div>



              {/* Items Card */}
              <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4">
                  {locale === "vi" ? "Sản phẩm trong đơn hàng" : "Ordered Items"}
                </h3>
                <div className="divide-y divide-slate-100">
                  {order.items.map((item, index) => (
                    <div key={index} className="py-4 first:pt-0 last:pb-0 flex items-start gap-4">
                      {getProductImage(item.name) ? (
                        <div className="h-16 w-16 rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden shrink-0 select-none">
                          <img 
                            src={getProductImage(item.name)} 
                            alt={item.name} 
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-16 w-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-package size-6 stroke-[1.5]">
                            <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"></path>
                            <path d="M12 22V12"></path>
                            <polyline points="3.29 7 12 12 20.71 7"></polyline>
                            <path d="m7.5 4.27 9 5.15"></path>
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 text-left space-y-1">
                        <span className="text-xs font-extrabold text-slate-800 hover:text-orange-655 block transition-colors leading-tight">
                          {item.name}
                        </span>
                        <div className="text-[10px] text-slate-400 font-semibold space-y-0.5">
                          {Object.entries(item.options).length > 0 && (
                            <span className="block text-slate-500 capitalize">
                              {Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(" | ")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="block text-xs font-black text-slate-800">{formatPrice(item.price)}</span>
                        <span className="block text-[10px] text-slate-400 font-bold mt-0.5">Qty: 1</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Return Action Card */}
              {(order.status.toLowerCase() === "delivered" || order.status.toLowerCase() === "pending" || order.status.toLowerCase() === "processed") && (
                <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 text-left">
                    {locale === "vi" ? "Yêu cầu Đổi/Trả hàng" : "Returns & Exchanges"}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-semibold leading-relaxed text-left">
                    {locale === "vi" 
                      ? "Bạn có thể yêu cầu đổi hoặc trả hàng nếu gặp vấn đề với các sản phẩm trong đơn hàng này."
                      : "You can file a return or exchange claim if there is an issue with the items in this order."}
                  </p>
                  <Link
                    href={`/account/orders/${encodeURIComponent(orderId)}/returns`}
                    className="w-full bg-slate-800 text-white hover:bg-slate-900 py-3 rounded-2xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm select-none border-none text-center block"
                  >
                    <span>{locale === "vi" ? "Yêu cầu trả hàng/hoàn tiền" : "Request Return/Refund"}</span>
                  </Link>
                </div>
              )}

            </div>

            {/* COLUMN 3: Right details panel */}
            <div className="space-y-6">
              
              {/* Customer and Delivery Info */}
              <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-6">
                
                {/* Shipping info */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <MapPin className="size-4 text-slate-400" />
                    <span>{locale === "vi" ? "Địa chỉ giao hàng" : "Shipping Address"}</span>
                  </h4>
                  <div className="text-xs leading-relaxed text-slate-600 font-semibold">
                    <p className="font-extrabold text-slate-800">{order.address.address1}</p>
                    {order.address.address2 && <p>{order.address.address2}</p>}
                    <p>{order.address.city}, {order.address.state} {order.address.zip}</p>
                    <p className="text-slate-400 mt-1">{order.address.country}</p>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-5 space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <CreditCard className="size-4 text-slate-400" />
                    <span>{locale === "vi" ? "Thanh toán & Hóa đơn" : "Payment & Bills"}</span>
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>{locale === "vi" ? "Phương thức thanh toán" : "Payment Method"}</span>
                      <span className="font-extrabold text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/50">
                        {getPaymentMethodLabel(order.payment_history?.[0]?.payment_method_id || "paypal_6151711")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>{locale === "vi" ? "Tạm tính" : "Subtotal"}</span>
                      <span>{formatPrice(order.total)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>{locale === "vi" ? "Giao hàng" : "Shipping"}</span>
                      <span className="text-emerald-600 uppercase text-[10px] font-black">Free</span>
                    </div>
                    <div className="border-t border-slate-100 pt-2 flex items-center justify-between text-sm">
                      <span className="font-black text-slate-800">{locale === "vi" ? "Tổng cộng" : "Total"}</span>
                      <span className="font-black text-[#ff4e20]">{formatPrice(order.total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed Order Tracking History Card */}
              <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b pb-2 text-left">
                  {locale === "vi" ? "Lịch sử hành trình đơn hàng" : "Order Tracking History"}
                </h3>
                
                {isLoadingTracking ? (
                  <div className="flex items-center justify-center py-6 text-slate-400 text-xs font-medium gap-2">
                    <Clock className="size-4 animate-spin text-orange-500" />
                    <span>{locale === "vi" ? "Đang tải dữ liệu..." : "Loading trackings..."}</span>
                  </div>
                ) : trackings.length === 0 ? (
                  <div className="text-center py-4 text-slate-400 text-xs font-medium">
                    {locale === "vi" ? "Chưa có thông tin hành trình." : "No tracking logs found."}
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-5 border-l border-slate-100/80 text-left">
                    {trackings.map((track, idx) => {
                      const isLatest = idx === 0;
                      const dt = track.createdAt ? new Date(track.createdAt) : null;
                      const formattedDate = dt 
                        ? dt.toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })
                        : "";
                      
                      return (
                        <div key={track.id || idx} className="relative group">
                          {/* Dot indicator */}
                          <div className={`absolute -left-[30px] top-1.5 h-3 w-3 rounded-full border transition-all ${
                            isLatest 
                              ? "bg-orange-500 border-orange-500 ring-4 ring-orange-100 shadow-sm" 
                              : "bg-white border-slate-350"
                          }`} />
                          
                          {/* Event body */}
                          <div className="space-y-1">
                            <span className={`text-[10px] font-black uppercase tracking-wider ${
                              isLatest ? "text-orange-655 font-extrabold" : "text-slate-400"
                            }`}>
                              {track.event?.replace("_", " ") || "EVENT"}
                            </span>
                            <p className={`text-xs font-semibold leading-relaxed ${
                              isLatest ? "text-slate-800 font-black" : "text-slate-650"
                            }`}>
                              {track.message}
                            </p>
                            {formattedDate && (
                              <span className="block text-[9px] text-slate-400 font-bold select-none font-mono">
                                {formattedDate}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>



            </div>

          </div>



        </div>
      </div>
    </ClientLayout>
  );
}
