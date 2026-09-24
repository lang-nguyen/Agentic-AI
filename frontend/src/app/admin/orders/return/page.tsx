"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import PageHeader from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/common/ui/card";
import { Button } from "@/components/common/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/common/ui/table";
import {
  Search,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  ShoppingBag,
  ChevronRight,
  MessageSquare,
  FileText,
  DollarSign,
  User,
  Copy
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

export default function ReturnProcessingPage() {
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // AI processed IDs tracking list
  const [autoApprovedIds, setAutoApprovedIds] = useState<string[]>([]);

  // Refund Modal State
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [activeReturnId, setActiveReturnId] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState("REFUND_IMMEDIATELY");

  const fetchReturnRequests = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("store:token");

      const res = await fetch(`${API_CONFIG.webBackendBaseUrl}/api/admin/return-requests`, {
        headers: {
          "Authorization": token ? `Bearer ${token}` : "",
        }
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Phiên làm việc hết hạn. Vui lòng đăng nhập lại với tư cách Admin.");
        }
        throw new Error("Không thể tải danh sách yêu cầu đổi trả.");
      }

      const data = await res.json();
      // Sort by newest first
      const sortedData = data.sort((a: ReturnRequest, b: ReturnRequest) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setRequests(sortedData);

      // Fetch AI agent logs to determine automated requests
      try {
        const agentLogsRes = await fetch(`${API_CONFIG.rulesEngineBaseUrl}/api/smart-return/agent/logs`);
        if (agentLogsRes.ok) {
          const logs = await agentLogsRes.json();
          const autoIds = logs.map((log: any) => log.return_id);
          setAutoApprovedIds(autoIds);
        }
      } catch (logErr) {
        console.error("Không thể tải lịch sử AI agent logs:", logErr);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Đã xảy ra lỗi khi kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReturnRequests();
  }, [fetchReturnRequests]);

  const handleUpdateStatus = useCallback(async (returnId: string, newStatus: "APPROVED" | "REJECTED", action?: string) => {
    try {
      setProcessingId(returnId);
      const token = localStorage.getItem("store:token");

      const bodyPayload: any = { status: newStatus };
      if (action) {
        bodyPayload.action = action;
      }

      const res = await fetch(`${API_CONFIG.webBackendBaseUrl}/api/admin/return-requests/${returnId}/status`, {
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

      // Refresh list
      await fetchReturnRequests();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Không thể cập nhật trạng thái");
    } finally {
      setProcessingId(null);
    }
  }, [fetchReturnRequests]);

  const handleConfirmRefund = async () => {
    if (!activeReturnId) return;
    await handleUpdateStatus(activeReturnId, "APPROVED", selectedAction);
    setShowRefundModal(false);
    setActiveReturnId(null);
  };

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === "APPROVED") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black text-emerald-600 border border-emerald-100 shadow-3xs">
          Đã Duyệt
        </span>
      );
    }
    if (s === "REJECTED") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-black text-rose-600 border border-rose-100 shadow-3xs">
          Từ Chối
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-black text-amber-600 border border-amber-100 shadow-3xs animate-pulse">
        Chờ Xử Lý
      </span>
    );
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "REFUND_IMMEDIATELY":
        return "Hoàn tiền ngay";
      case "REFUND_AND_RETURN":
        return "Trả hàng và Hoàn tiền";
      case "REJECT_REFUND":
        return "Từ chối hoàn tiền";
      case "WAIT_FOR_APPROVAL":
        return "Chờ duyệt thủ công";
      default:
        return action || "Chưa xác định";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount * 25000); // Convert USD to VND to match the Shopee look exactly (e.g. 250.000đ)
  };

  const formatDateSimple = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
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
    if (!paymentMethodId) return "";
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

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}: ${text}`);
  };

  // Filter requests based on search and tab selection
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const matchesStatus = statusFilter === "all" || req.status.toLowerCase() === statusFilter.toLowerCase();

      const query = searchQuery.toLowerCase();
      const matchesSearch =
        req.returnId.toLowerCase().includes(query) ||
        req.orderId.toLowerCase().includes(query) ||
        req.userId.toLowerCase().includes(query) ||
        req.items.some(item => item.name.toLowerCase().includes(query));

      return matchesStatus && matchesSearch;
    });
  }, [requests, statusFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-55/50 p-6 md:p-8 font-sans admin-theme text-slate-800 flex flex-col">
      <Toaster position="top-right" />

      {/* Main Dashboard Card */}
      <Card className="bg-white border-slate-100 shadow-2xs rounded-2xl flex-1 flex flex-col min-h-0 text-left overflow-hidden">

        {/* Card Header Panel */}
        <div className="p-6 border-b border-slate-100 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-extrabold text-slate-800">
                Danh sách yêu cầu đổi trả hoàn tiền
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 font-medium mt-0.5">
                Xem chi tiết thông tin hình ảnh, lý do, số tiền hoàn và trạng thái để phê duyệt yêu cầu.
              </CardDescription>
            </div>

            <Button
              variant="outline"
              onClick={fetchReturnRequests}
              disabled={loading}
              className="bg-slate-55 hover:bg-slate-100 text-slate-700 rounded-xl px-4 py-2 text-xs font-extrabold flex items-center justify-center gap-2 border border-slate-200 cursor-pointer self-start md:self-auto"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Làm Mới
            </Button>
          </div>

          {/* Filtering & Searching Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">

            {/* Status Tabs */}
            <div className="flex bg-slate-100/80 p-0.5 rounded-xl w-fit border border-slate-200/40">
              {[
                { label: "Tất cả", value: "all" },
                { label: "Chờ xử lý", value: "pending_processing" },
                { label: "Đã duyệt", value: "approved" },
                { label: "Từ chối", value: "rejected" },
              ].map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={`px-4 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${statusFilter === tab.value
                    ? "bg-white text-indigo-650 shadow-3xs"
                    : "text-slate-555 hover:text-slate-850"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm mã đổi trả, đơn hàng, sản phẩm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-55 border border-slate-200 pl-9 pr-4 py-2 text-xs rounded-xl outline-none focus:border-indigo-500 transition-all font-semibold text-slate-800 placeholder-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Card Content Table (Shopee-style Card Table) */}
        <CardContent className="p-0 flex-1 overflow-x-auto">
          {loading && requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2 text-slate-400">
              <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
              <p className="text-xs">Đang tải dữ liệu yêu cầu đổi trả...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center select-none">
              <ShoppingBag className="h-10 w-10 text-slate-350 mb-2" />
              <p className="text-sm font-extrabold text-slate-500">Không tìm thấy yêu cầu nào</p>
              <p className="text-xs text-slate-400 mt-0.5">Vui lòng kiểm tra lại điều kiện lọc hoặc từ khóa tìm kiếm.</p>
            </div>
          ) : (
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow className="bg-slate-50 border-b border-slate-100">
                  <TableHead className="w-[20%] font-extrabold text-slate-500 pl-6">Sản phẩm</TableHead>
                  <TableHead className="w-[15%] font-extrabold text-slate-500">Số tiền</TableHead>
                  <TableHead className="w-[20%] font-extrabold text-slate-500">Lý do & Ý kiến</TableHead>
                  <TableHead className="w-[12%] font-extrabold text-slate-500">Phương án</TableHead>
                  <TableHead className="w-[10%] font-extrabold text-slate-500 text-center">Trạng thái</TableHead>
                  <TableHead className="w-[8%] font-extrabold text-slate-500 text-right pr-6">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((req) => {
                  const totalExpectedRefund = req.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                  const itemsCount = req.items.length;

                  return (
                    <React.Fragment key={req.id}>
                      {/* Sub-header row for this request group (Shopee Card Header) */}
                      <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-t border-b border-slate-200/50 select-none">
                        <TableCell colSpan={6} className="py-2.5 px-6">
                          <div className="flex items-center gap-3.5 text-[11px] text-slate-500 font-semibold">
                            <div className="flex items-center gap-1.5">
                              <div className="size-5 rounded-full bg-slate-200/80 flex items-center justify-center shrink-0">
                                <User className="size-3 text-slate-500" />
                              </div>
                              <span className="text-slate-800 font-bold">{req.userId}</span>
                            </div>
                            <span className="text-slate-300">|</span>
                            <div className="flex items-center gap-1">
                              <span>Mã đơn hàng </span>
                              <span
                                onClick={() => handleCopyText(req.orderId, "mã đơn hàng")}
                                className="text-slate-800 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                              >
                                {req.orderId}
                                <Copy className="size-3 text-slate-400" />
                              </span>
                            </div>
                            <span className="text-slate-300">|</span>
                            <div className="flex items-center gap-1">
                              <span>Mã yêu cầu trả hàng </span>
                              <span
                                onClick={() => handleCopyText(req.returnId, "mã yêu cầu trả hàng")}
                                className="text-slate-800 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                              >
                                {req.returnId}
                                <Copy className="size-3 text-slate-400" />
                              </span>
                            </div>
                            <span className="text-slate-300">|</span>
                            <span className="text-slate-400">Yêu cầu vào lúc: {formatDateTime(req.createdAt)}</span>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Map items inside this request */}
                      {req.items.map((item, idx) => {
                        return (
                          <TableRow key={item.itemId} className="hover:bg-slate-55/10 border-b border-slate-100 last:border-b-2">
                            {/* Column 1: Sản phẩm (renders for every item) */}
                            <TableCell className="pl-6 align-top">
                              <div className="flex gap-3 items-start">
                                <div className="size-14 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                                  {item.images && item.images.length > 0 ? (
                                    <img
                                      src={item.images[0]}
                                      alt={item.name}
                                      className="size-full object-cover"
                                    />
                                  ) : (
                                    <ShoppingBag className="size-6 text-slate-400" />
                                  )}
                                </div>
                                <div className="space-y-0.5">
                                  <span className="font-bold text-slate-800 leading-tight block line-clamp-2">
                                    {item.name}
                                  </span>
                                  <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500 font-semibold">
                                    <span className="text-slate-400">x{item.quantity}</span>
                                    <span className="text-slate-300">|</span>
                                    <span className="text-slate-400">{formatCurrency(item.price)}</span>
                                  </div>
                                </div>
                              </div>
                            </TableCell>

                            {/* Render columns 2 to 6 spanned vertically from the first item row */}
                            {idx === 0 && (
                              <>
                                {/* Column 2: Số tiền */}
                                <TableCell rowSpan={itemsCount} className="align-top">
                                  <div className="space-y-0.5 text-xs text-left">
                                    <span className="text-[10px] text-slate-455 font-bold block">Dự kiến hoàn tiền</span>
                                    <span className="font-extrabold text-slate-800 text-sm">{formatCurrency(totalExpectedRefund)}</span>
                                    {req.paymentMethodId && (
                                      <span className="text-[9px] text-indigo-650 font-bold block mt-1 leading-normal">
                                        P.Thức: {getPaymentMethodName(req.paymentMethodId)}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>

                                {/* Column 3: Lý do & Ý kiến */}
                                <TableCell rowSpan={itemsCount} className="align-top">
                                  <div className="space-y-1 text-xs text-slate-700 font-bold leading-normal">
                                    <p>{getReasonTranslation(req.reason)}</p>
                                    {item.customerComment && (
                                      <div className="flex gap-1 items-start bg-slate-50 p-1.5 rounded-lg mt-1 max-w-[200px]">
                                        <MessageSquare className="size-3 text-slate-400 shrink-0 mt-0.5" />
                                        <p className="text-[9px] text-slate-455 italic leading-snug break-words font-semibold">
                                          "{item.customerComment}"
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>

                                {/* Column 4: Phương án */}
                                <TableCell rowSpan={itemsCount} className="align-top">
                                  <span className="text-xs font-bold text-slate-700">
                                    {getActionBadge(req.action)}
                                  </span>
                                </TableCell>

                                {/* Column 5: Trạng thái */}
                                <TableCell rowSpan={itemsCount} className="align-top text-center">
                                  <div className="space-y-1">
                                    <div className="flex flex-col items-center gap-1.5 justify-center">
                                      {getStatusBadge(req.status)}
                                      {autoApprovedIds.includes(req.returnId) && (
                                        <span className="inline-flex items-center rounded-none bg-indigo-50 px-1.5 py-0.5 text-[8px] font-black text-indigo-650 border border-indigo-100 shadow-3xs uppercase tracking-wider">
                                          AI Agent
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[9px] text-slate-400 font-semibold block mt-1">
                                      vào lúc: {formatDateTime(req.updatedAt)}
                                    </span>
                                  </div>
                                </TableCell>

                                {/* Column 6: Thao tác */}
                                <TableCell rowSpan={itemsCount} className="pr-6 align-top text-right">
                                  <div className="flex flex-col gap-1.5 items-end justify-center max-w-[100px] ml-auto">
                                    <a
                                      href={`/admin/orders/return/${req.returnId}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="hover:bg-slate-200 text-slate-700 px-2.5 py-2 text-[10px] font-extrabold cursor-pointer border border-slate-200 w-full text-center block rounded-none"
                                    >
                                      Chi tiết
                                    </a>

                                    {(
                                      <>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled={processingId !== null || req.status !== "PENDING_PROCESSING"}
                                          onClick={() => {
                                            setActiveReturnId(req.returnId);
                                            setSelectedAction("REFUND_IMMEDIATELY");
                                            setShowRefundModal(true);
                                          }}
                                          className="bg-transparent hover:bg-slate-200 text-slate-700 px-2.5 py-1 text-[10px] font-extrabold cursor-pointer border border-slate-200 w-full text-center block rounded-none"
                                        >
                                          Hoàn Tiền
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled={processingId !== null || req.status !== "PENDING_PROCESSING"}
                                          onClick={() => handleUpdateStatus(req.returnId, "REJECTED", "REJECT_REFUND")}
                                          className="bg-transparent border-rose-200 hover:text-rose-600 hover:bg-rose-50 text-rose-600 px-2.5 py-1 text-[10px] font-extrabold cursor-pointer w-full text-center rounded-none"
                                        >
                                          Từ Chối
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
                  setActiveReturnId(null);
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
