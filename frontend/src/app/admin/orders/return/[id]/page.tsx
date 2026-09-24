"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/common/ui/card";
import { Button } from "@/components/common/ui/button";
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  Settings,
  ShoppingBag,
  MessageSquare,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  User,
  Copy,
  MapPin,
  Truck,
  Send,
  FileText,
  Bot
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/common/ui/sonner";
import { API_CONFIG } from "@/config/api";
import { getReasonTranslation } from "@/features/returns/reasons";

interface ReturnItem {
  itemId: string;
  productId: string;
  name: string;
  quantity: number;
  price: number;
  reason: string;
  customerComment: string;
  images: string[];
}

interface ReturnRequest {
  id: string;
  returnId: string;
  orderId: string;
  userId: string;
  type: string;
  reason: string;
  status: string;
  action: string;
  paymentMethodId: string;
  items: ReturnItem[];
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  sender: "buyer" | "shop";
  username: string;
  content: string;
  timestamp: string;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ReturnRequestDetailPage({ params }: PageProps) {
  const { id } = React.use(params);
  const [request, setRequest] = useState<ReturnRequest | null>(null);
  const [relatedOrder, setRelatedOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // AI auto approved status state
  const [isAutoApproved, setIsAutoApproved] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState("");

  // Refund Modal State
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState("REFUND_IMMEDIATELY");

  const fetchRequestDetail = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("store:token");

      // 1. Fetch return requests
      const res = await fetch(`${API_CONFIG.webBackendBaseUrl}/api/admin/return-requests`, {
        headers: {
          "Authorization": token ? `Bearer ${token}` : "",
        }
      });

      if (!res.ok) {
        throw new Error("Không thể tải danh sách chi tiết yêu cầu đổi trả.");
      }

      const data: ReturnRequest[] = await res.json();
      const matched = data.find(req => req.returnId === id || req.id === id);

      if (!matched) {
        throw new Error("Không tìm thấy thông tin yêu cầu đổi trả với mã này.");
      }

      setRequest(matched);

      // 2. Fetch related order details for genuine shipping address and variants
      try {
        const orderRes = await fetch(`${API_CONFIG.webBackendBaseUrl}/api/admin/orders`, {
          headers: {
            "Authorization": token ? `Bearer ${token}` : "",
          }
        });
        if (orderRes.ok) {
          const ordersList = await orderRes.json();
          const cleanOrderId = matched.orderId.replace("#", "");
          const matchedOrder = ordersList.find((o: any) => {
            const cleanOId = o.orderId.replace("#", "");
            return cleanOId === cleanOrderId;
          });
          setRelatedOrder(matchedOrder);
        }
      } catch (orderErr) {
        console.error("Lỗi khi tải thông tin đơn hàng liên quan:", orderErr);
      }

      // 3. Fetch agent logs to determine if this request was processed by AI
      try {
        const agentLogsRes = await fetch(`${API_CONFIG.rulesEngineBaseUrl}/api/smart-return/agent/logs`);
        if (agentLogsRes.ok) {
          const logs = await agentLogsRes.json();
          const hasLog = logs.some((log: any) => log.return_id === matched.returnId || log.return_id === matched.id);
          setIsAutoApproved(hasLog);
        }
      } catch (logErr) {
        console.error("Không thể tải lịch sử AI agent logs:", logErr);
      }

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRequestDetail();
  }, [fetchRequestDetail]);

  // Sync opening chat message with actual customer comment
  useEffect(() => {
    if (request) {
      const messages: ChatMessage[] = [];
      const timeStr = formatDateSimple(request.createdAt);

      if (request.items[0]?.customerComment) {
        messages.push({
          sender: "buyer",
          username: request.userId,
          content: request.items[0].customerComment,
          timestamp: timeStr
        });
      }
      setChatMessages(messages);
    }
  }, [request]);

  const handleUpdateStatus = async (newStatus: "APPROVED" | "REJECTED", action?: string) => {
    if (!request) return;
    try {
      setProcessingId(request.returnId);
      const token = localStorage.getItem("store:token");

      const bodyPayload: any = { status: newStatus };
      if (action) {
        bodyPayload.action = action;
      }

      const res = await fetch(`${API_CONFIG.webBackendBaseUrl}/api/admin/return-requests/${request.returnId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) {
        throw new Error("Cập nhật trạng thái thất bại.");
      }

      toast.success(newStatus === "APPROVED" ? "Đã duyệt yêu cầu đổi trả!" : "Đã từ chối yêu cầu đổi trả.");
      setRequest(prev => prev ? { ...prev, status: newStatus, action: action || prev.action } : null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Không thể cập nhật trạng thái");
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmRefund = async () => {
    await handleUpdateStatus("APPROVED", selectedAction);
    setShowRefundModal(false);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim()) return;

    const currentFormattedTime = new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit"
    }) + " " + new Date().toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });

    setChatMessages(prev => [
      ...prev,
      {
        sender: "shop",
        username: "Shop Hệ Thống",
        content: newMessageText.trim(),
        timestamp: currentFormattedTime
      }
    ]);

    setNewMessageText("");
    toast.success("Đã gửi tin nhắn cho khách hàng!");
  };

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === "APPROVED") {
      return (
        <div className="flex items-center gap-2">
          {isAutoApproved && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-black border border-indigo-100 shadow-3xs">
              AI Agent
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-650 border border-emerald-100 shadow-3xs">
            <CheckCircle className="size-3.5" />
            Đã Duyệt
          </span>
        </div>
      );
    }
    if (s === "REJECTED") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-650 border border-rose-100 shadow-3xs">
          <XCircle className="size-3.5" />
          Từ Chối
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-650 border border-amber-100 shadow-3xs animate-pulse">
        <Clock className="size-3.5" />
        Chờ Xử Lý
      </span>
    );
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "REFUND_IMMEDIATELY":
        return "Hoàn tiền ngay (Không cần trả hàng)";
      case "REFUND_AND_RETURN":
        return "Trả hàng và Hoàn tiền";
      case "REJECT_REFUND":
        return "Từ chối hoàn tiền";
      default:
        return action || "Chưa xác định";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount * 25000);
  };

  const formatDateSimple = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const timeStr = date.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      });
      const dateStr = date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
      return `${timeStr} ${dateStr}`;
    } catch {
      return dateString;
    }
  };

  const getPaymentMethodName = (paymentMethodId: string) => {
    if (!paymentMethodId) return "Chưa xác định";
    const lowercaseId = paymentMethodId.toLowerCase();
    if (lowercaseId.startsWith("paypal")) {
      return "PayPal";
    }
    if (lowercaseId.startsWith("stripe")) {
      return "Thẻ tín dụng (Stripe)";
    }
    if (lowercaseId.startsWith("vnpay")) {
      return "Cổng VNPAY";
    }
    if (lowercaseId.startsWith("momo")) {
      return "Ví MoMo";
    }
    if (lowercaseId.startsWith("cod")) {
      return "Thanh toán khi nhận hàng (COD)";
    }
    const parts = paymentMethodId.split("_");
    if (parts.length > 0) {
      return parts[0].toUpperCase();
    }
    return paymentMethodId;
  };

  // Helper to extract real item options/variants from fetched order details
  const getProductOptions = (productId: string, itemId: string) => {
    if (!relatedOrder || !relatedOrder.items) return null;
    const orderItem = relatedOrder.items.find(
      (oItem: any) => oItem.product_id === productId || oItem.item_id === itemId
    );
    if (orderItem && orderItem.options && Object.keys(orderItem.options).length > 0) {
      return Object.entries(orderItem.options)
        .map(([key, val]) => `${key}: ${val}`)
        .join(", ");
    }
    return null;
  };

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}: ${text}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-55/50 p-6 md:p-8 flex flex-col items-center justify-center gap-3 text-slate-500 font-sans">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
        <p className="text-xs">Đang tải thông tin chi tiết yêu cầu đổi trả...</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-slate-55/50 p-6 md:p-8 flex flex-col items-center justify-center gap-4 text-slate-500 font-sans select-none">
        <ShoppingBag className="h-10 w-10 text-slate-350" />
        <p className="text-sm font-extrabold text-slate-600">Không tìm thấy yêu cầu đổi trả</p>
        <Button
          onClick={() => window.close()}
          className="bg-indigo-650 hover:bg-indigo-755 text-white rounded-none text-xs font-bold px-4 py-2 cursor-pointer border-none shadow-3xs"
        >
          Đóng Tab này
        </Button>
      </div>
    );
  }

  const totalRefundAmount = request.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Format real address from related order if present
  const shippingAddress = relatedOrder?.address
    ? `${relatedOrder.address.address1}, ${relatedOrder.address.city}, ${relatedOrder.address.state}`
    : null;

  return (
    <div className="min-h-screen bg-slate-55/50 p-6 md:p-8 font-sans admin-theme text-slate-800 flex flex-col gap-6">
      <Toaster position="top-right" />

      {/* Detail Header Back button */}
      <div className="flex items-center justify-between select-none">
        <button
          onClick={() => window.close()}
          className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-all cursor-pointer bg-white border border-slate-200 px-3 py-1.5 rounded-none shadow-3xs"
        >
          <ArrowLeft className="size-4" />
          Đóng chi tiết (Trở lại danh sách)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column - Shopee Style details (Takes 2 cols) */}
        <div className="lg:col-span-2 space-y-6">

          {/* Section 1: Thông tin đổi trả từ khách hàng */}
          <Card className="bg-white border-slate-100 shadow-2xs rounded-2xl p-6 text-left space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2 select-none">
                Thông tin đổi trả từ khách hàng
              </h2>
            </div>

            {/* Mã yêu cầu */}
            <div className="space-y-1">
              <span className="text-xs font-black text-slate-455 flex items-center gap-1.5 select-none">
                <FileText className="size-3.5" />
                Mã yêu cầu
              </span>
              <div className="flex items-center gap-3">
                <span className="text-slate-800 font-extrabold text-sm">{request.returnId}</span>
                <span className="text-xs text-orange-500 font-extrabold hover:underline cursor-pointer">
                  Xem đơn hàng liên quan
                </span>
              </div>
            </div>

            {/* Lý do từ Người mua */}
            <div className="bg-orange-50/50 border border-orange-100/60 rounded-xl p-4 space-y-3">
              <span className="text-xs font-black text-orange-600 flex items-center gap-1.5 select-none">
                <MessageSquare className="size-3.5 text-orange-500" />
                Lý do từ Người mua
              </span>

              {/* Product Evidence Images */}
              {request.items[0]?.images && request.items[0].images.length > 0 && (
                <div className="flex gap-3 flex-wrap">
                  {request.items[0].images.map((img, imgIdx) => (
                    <a
                      key={imgIdx}
                      href={img}
                      target="_blank"
                      rel="noreferrer"
                      className="size-16 rounded-lg border border-slate-200 overflow-hidden hover:scale-105 transition-all bg-slate-55 shrink-0 block"
                    >
                      <img src={img} alt={`Bằng chứng ${imgIdx}`} className="size-full object-cover" />
                    </a>
                  ))}
                </div>
              )}

              <div className="space-y-0.5 font-bold text-slate-700 text-xs leading-relaxed">
                <p className="font-extrabold text-slate-850">{getReasonTranslation(request.reason)}</p>
                {request.items[0]?.customerComment && (
                  <p className="text-slate-500 mt-1 font-semibold italic">"{request.items[0].customerComment}"</p>
                )}
              </div>
            </div>

            {/* Địa chỉ nhận hàng (genuine order shipping address if available) */}
            {shippingAddress && (
              <div className="space-y-1">
                <span className="text-xs font-black text-slate-450 flex items-center gap-1.5 select-none">
                  <MapPin className="size-3.5" />
                  Địa chỉ nhận hàng (Giao hàng)
                </span>
                <p className="text-slate-750 font-bold text-xs">
                  {shippingAddress}
                </p>
              </div>
            )}
          </Card>

          {/* Section 2: Thông tin sản phẩm đổi trả */}
          <Card className="bg-white border-slate-100 shadow-2xs rounded-2xl p-6 text-left space-y-4">
            <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2 select-none border-b border-slate-100 pb-3">
              <ShoppingBag className="size-5 text-indigo-650" />
              Thông tin sản phẩm đổi trả
            </h2>

            <div className="space-y-4 divide-y divide-slate-100">
              {request.items.map((item, idx) => {
                const options = getProductOptions(item.productId, item.itemId);
                return (
                  <div key={item.itemId} className="pt-4 first:pt-0 flex items-center justify-between gap-4">
                    <div className="flex gap-3.5 items-start">
                      <div className="size-14 rounded-lg border border-slate-200 bg-slate-55 flex items-center justify-center overflow-hidden shrink-0">
                        {item.images && item.images.length > 0 ? (
                          <img src={item.images[0]} alt={item.name} className="size-full object-cover" />
                        ) : (
                          <ShoppingBag className="size-6 text-slate-400" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <span className="font-extrabold text-slate-850 text-xs block leading-snug">
                          {item.name}
                        </span>
                        {options && (
                          <span className="text-[10px] text-slate-455 font-bold block">
                            Phân loại: {options}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-slate-700 block">{formatCurrency(item.price)}</span>
                      <span className="text-[10px] text-slate-400 font-bold block mt-0.5">x{item.quantity}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Section 3: Nội dung trò chuyện với khách hàng */}
          <Card className="bg-white border-slate-100 shadow-2xs rounded-2xl p-6 text-left flex flex-col h-[400px]">
            <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2 select-none border-b border-slate-100 pb-3 mb-4 shrink-0">
              <MessageSquare className="size-5 text-indigo-650" />
              Nội dung trò chuyện với khách hàng
            </h2>

            {/* Messages box */}
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-2 mb-4">
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 select-none">
                  <MessageSquare className="size-8 text-slate-300 mb-1" />
                  <p className="text-[11px] font-bold">Chưa có tin nhắn nào trong hội thoại này</p>
                </div>
              ) : (
                chatMessages.map((msg, idx) => {
                  const isShop = msg.sender === "shop";
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col max-w-[80%] ${isShop ? "ml-auto items-end" : "mr-auto items-start"}`}
                    >
                      {/* User ID / Timestamp */}
                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 mb-0.5 select-none">
                        <span>{msg.username}</span>
                        <span>•</span>
                        <span>{msg.timestamp}</span>
                      </div>

                      {/* Message Bubble */}
                      <div className={`p-3 rounded-2xl text-xs font-semibold leading-relaxed ${isShop
                        ? "bg-indigo-50 text-indigo-900 rounded-tr-none border border-indigo-100"
                        : "bg-slate-55 text-slate-800 rounded-tl-none border border-slate-100"
                        }`}>
                        {msg.content}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Chat Input Box */}
            <form onSubmit={handleSendMessage} className="flex gap-2 items-center border-t border-slate-100 pt-3 shrink-0">
              <div className="size-8 rounded-xl hover:bg-slate-50 border border-slate-200 flex items-center justify-center cursor-pointer shrink-0">
                <ImageIcon className="size-4 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Gửi tin nhắn"
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 px-4 py-2 text-xs rounded-xl outline-none focus:bg-white focus:border-indigo-500 transition-all font-semibold text-slate-800 placeholder-slate-400"
              />
              <Button
                type="submit"
                size="sm"
                className="bg-indigo-650 bg-indigo-700 text-white rounded-xl px-4 py-2 cursor-pointer font-bold border-none flex items-center gap-1.5"
              >
                Gửi
                <Send className="size-3" />
              </Button>
            </form>
          </Card>
        </div>

        {/* Right Column - Decision panel & Timeline (Takes 1 col) */}
        <div className="space-y-6">

          {/* Metadata Card */}
          <Card className="bg-white border-slate-100 shadow-2xs rounded-2xl p-6 text-left space-y-4">
            <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3 select-none">
              Quyết định hoàn tiền
            </h2>

            <div className="space-y-4 text-xs">
              {/* Status Section */}
              <div className="flex items-center justify-between">
                <span className="text-slate-455 font-bold">Trạng thái:</span>
                <span>{getStatusBadge(request.status)}</span>
              </div>

              {/* General details list */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="text-slate-455 font-bold">Mã đơn hàng:</span>
                  <span
                    onClick={() => handleCopyText(request.orderId, "mã đơn hàng")}
                    className="font-extrabold text-slate-850 hover:underline cursor-pointer flex items-center gap-0.5"
                  >
                    {request.orderId}
                    <Copy className="size-3 text-slate-400" />
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-455 font-bold">Tài khoản khách:</span>
                  <span className="font-extrabold text-slate-850">{request.userId}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-455 font-bold">Phương thức trả:</span>
                  <span className="font-bold text-slate-700">{getPaymentMethodName(request.paymentMethodId)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-455 font-bold">Phương án:</span>
                  <span className="font-black text-indigo-650 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-0.5 text-[10px]">
                    {getActionBadge(request.action)}
                  </span>
                </div>
              </div>

              {/* Total Refund Summary */}
              <div className="pt-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/50 p-3.5 rounded-xl border border-slate-100">
                <span className="text-slate-500 font-extrabold">Tổng tiền hoàn trả:</span>
                <span className="font-black text-slate-850 text-base">{formatCurrency(totalRefundAmount)}</span>
              </div>

              {/* Approve/Reject Controls */}
              {request.status === "PENDING_PROCESSING" ? (
                <div className="pt-2 flex flex-col gap-2 select-none">
                  <Button
                    onClick={() => {
                      setSelectedAction("REFUND_IMMEDIATELY");
                      setShowRefundModal(true);
                    }}
                    disabled={processingId !== null}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-none py-2.5 text-xs font-extrabold cursor-pointer border-none shadow-3xs text-center"
                  >
                    Duyệt Hoàn Tiền
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleUpdateStatus("REJECTED", "REJECT_REFUND")}
                    disabled={processingId !== null}
                    className="w-full border-rose-200 hover:bg-rose-50 text-rose-600 rounded-none py-2.5 text-xs font-extrabold cursor-pointer text-center"
                  >
                    Từ Chối Yêu Cầu
                  </Button>
                </div>
              ) : (
                <div className="pt-2 text-center text-slate-400 font-semibold italic select-none space-y-3">
                  {isAutoApproved ? (
                    <>
                      <div>
                        Yêu cầu đã được xử lý tự động bởi AI Agent vào lúc<br />
                        <span className="font-extrabold text-slate-600 block mt-1">{formatDateTime(request.updatedAt)}</span>
                      </div>
                      <div className="pt-2.5 border-t border-slate-100 mt-2">
                        <a
                          href={`/admin/agent?returnId=${request.returnId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-[12px] text-indigo-650 hover:underline hover:text-indigo-700 px-2.5 py-1.5 tracking-wider transition-all select-none rounded-none"
                        >
                          Xem chi tiết
                        </a>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        Yêu cầu đã được xử lý vào lúc<br />
                        <span className="font-extrabold text-slate-600 block mt-1">{formatDateTime(request.updatedAt)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Timeline Card */}
          <Card className="bg-white border-slate-100 shadow-2xs rounded-2xl p-6 text-left space-y-4">
            <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3 select-none">
              <Clock className="size-5 text-indigo-650" />
              Mốc thời gian xử lý
            </h2>

            <div className="relative pl-6 border-l border-slate-200 ml-3 space-y-6 text-xs text-slate-700">

              {/* Khách tạo yêu cầu */}
              <div className="relative">
                <div className="absolute -left-[30px] top-0.5 size-3 bg-indigo-500 rounded-full border-2 border-white ring-4 ring-indigo-50"></div>
                <div className="space-y-0.5">
                  <p className="font-extrabold text-slate-850">Khách gửi yêu cầu trả hàng</p>
                  <p className="text-[10px] text-slate-500 font-bold">{formatDateTime(request.createdAt)}</p>
                  <p className="text-[10px] text-slate-400 font-semibold">Lý do: {getReasonTranslation(request.reason)}</p>
                </div>
              </div>

              {/* Kết quả phê duyệt */}
              <div className="relative">
                {request.status === "PENDING_PROCESSING" ? (
                  <>
                    <div className="absolute -left-[30px] top-0.5 size-3 bg-amber-500 rounded-full border-2 border-white ring-4 ring-amber-50 animate-pulse"></div>
                    <div className="space-y-0.5">
                      <p className="font-extrabold text-slate-800">Đang chờ xử lý</p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Đang chờ phê duyệt phương án</p>
                    </div>
                  </>
                ) : request.status === "APPROVED" ? (
                  <>
                    <div className="absolute -left-[30px] top-0.5 size-3 bg-emerald-600 rounded-full border-2 border-white ring-4 ring-emerald-50"></div>
                    <div className="space-y-0.5">
                      <p className="font-extrabold text-slate-850">
                        {isAutoApproved ? (
                          <a
                            href={`/admin/agent?returnId=${request.returnId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-700 hover:underline inline-flex items-center gap-1"
                          >
                            <Bot className="size-3" />
                            Đã duyệt tự động bởi AI
                          </a>
                        ) : "Đã duyệt hoàn tiền"}
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold">{formatDateTime(request.updatedAt)}</p>
                      <p className="text-[10px] text-emerald-600 font-bold">Phương án: {getActionBadge(request.action)}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="absolute -left-[30px] top-0.5 size-3 bg-rose-600 rounded-full border-2 border-white ring-4 ring-rose-50"></div>
                    <div className="space-y-0.5">
                      <p className="font-extrabold text-slate-850">
                        {isAutoApproved ? (
                          <a
                            href={`/admin/agent?returnId=${request.returnId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-rose-700 hover:underline inline-flex items-center gap-1"
                          >
                            <Bot className="size-3" />
                            Bị AI từ chối tự động
                          </a>
                        ) : "Từ chối yêu cầu"}
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold">{formatDateTime(request.updatedAt)}</p>
                      <p className="text-[10px] text-rose-600 font-bold">Yêu cầu bị từ chối hoàn trả</p>
                    </div>
                  </>
                )}
              </div>

            </div>
          </Card>
        </div>
      </div>

      {/* Custom Refund Action Selection Overlay Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs select-none">
          <div className="bg-white border border-slate-200 shadow-2xl p-6 max-w-md w-full rounded-none text-left space-y-4 animate-in fade-in-50 zoom-in-95 duration-150">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Lựa chọn hình thức hoàn tiền</h3>
              <p className="text-[11px] text-slate-400 font-semibold mt-1">
                Vui lòng chọn hình thức xử lý hoàn tiền cho yêu cầu này để cập nhật thông tin chính xác.
              </p>
            </div>

            {/* List of refund options */}
            <div className="space-y-2">
              {[
                {
                  value: "REFUND_IMMEDIATELY",
                  title: "Hoàn tiền ngay (Refund Immediately)",
                  description: "Chấp nhận hoàn lại số tiền dự kiến mà không cần khách hàng gửi trả sản phẩm."
                },
                {
                  value: "REFUND_AND_RETURN",
                  title: "Trả hàng & Hoàn tiền (Refund and Return)",
                  description: "Khách hàng bắt buộc phải đóng gói gửi trả lại sản phẩm trước khi nhận tiền hoàn."
                }
              ].map((item) => (
                <label
                  key={item.value}
                  onClick={() => setSelectedAction(item.value)}
                  className={`block p-3 border cursor-pointer transition-all rounded-none ${selectedAction === item.value
                    ? "border-indigo-650 bg-indigo-50/40 text-indigo-900"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="refundAction"
                      checked={selectedAction === item.value}
                      onChange={() => { }}
                      className="accent-indigo-600 size-3.5 cursor-pointer"
                    />
                    <span className="text-xs font-black">{item.title}</span>
                  </div>
                  <p className="text-[10px] text-slate-550 font-semibold mt-1 pl-5.5 leading-snug">
                    {item.description}
                  </p>
                </label>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => {
                  setShowRefundModal(false);
                  setSelectedAction("REFUND_IMMEDIATELY");
                }}
                variant="outline"
                className="flex-1 rounded-none text-slate-650 bg-white hover:bg-slate-100 text-xs font-extrabold py-2 cursor-pointer border border-slate-200 text-center"
              >
                Hủy bỏ
              </Button>
              <Button
                onClick={handleConfirmRefund}
                disabled={processingId !== null}
                className="flex-1 bg-indigo-650 bg-indigo-700 text-white rounded-none text-xs font-extrabold py-2 cursor-pointer border-none shadow-3xs text-center"
              >
                {processingId !== null ? "Đang xử lý..." : "Xác nhận"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
