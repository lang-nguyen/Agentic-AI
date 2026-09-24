import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { useOrders } from "@/features/orders/useOrders";
import { useLocale } from "@/contexts/locale.context";
import { useReturns } from "@/features/returns/useReturns";
import type { Order } from "@/types/store";
import { spacing, colors } from "@/theme/user";
import { API_CONFIG } from "@/config/api";
import {
  Package,
  ChevronDown,
  Check,
  UploadCloud,
  X,
  AlertCircle,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

// IMAGES resources used in returns step
const IMAGES = {
  keyboard: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=350&auto=format&fit=crop&q=80",
  mouse: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=350&auto=format&fit=crop&q=80",
  evidence: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=120&auto=format&fit=crop&q=80",
  successCheck: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=100&auto=format&fit=crop&q=80"
};

// Return Reasons options
interface ReasonOption {
  id: string;
  labelEn: string;
  labelVi: string;
}

import { REASONS_MAP } from "@/features/returns/reasons";

interface ReturnPageItem {
  item_id: string;
  product_id: string;
  name: string;
  nameEn: string;
  options: Record<string, string>;
  price: number;
  image: string;
  eligible: boolean;
  reason?: string;
  reasonEn?: string;
}

export interface ReturnsTabProps {
  selectedOrderId: string;
  setSelectedOrderId: (id: string) => void;
  isLocked?: boolean;
}

export function ReturnsTab({ selectedOrderId, setSelectedOrderId, isLocked = false }: ReturnsTabProps) {
  const { currentUser } = useAuth();
  const { orders } = useOrders();
  const { locale, t } = useLocale();
  const { refreshReturnRequests } = useReturns();

  // State definitions local to Returns Tab
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [returnReason, setReturnReason] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [evidencePreviews, setEvidencePreviews] = useState<string[]>([]);
  const [showOrderDropdown, setShowOrderDropdown] = useState(false);
  const [showReasonDropdown, setShowReasonDropdown] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [pickupMethod, setPickupMethod] = useState<"home" | "dropoff">("home");
  const [refundMethod, setRefundMethod] = useState<"lakipay" | "bank">("lakipay");
  const [bankName, setBankName] = useState<string>("");
  const [bankAccount, setBankAccount] = useState<string>("");
  const [requestType, setRequestType] = useState<"RETURN" | "EXCHANGE">("RETURN");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>("");
  const [reasons, setReasons] = useState<ReasonOption[]>([]);

  useEffect(() => {
    const fetchReasons = async () => {
      try {
        const token = localStorage.getItem("store:token");
        const res = await fetch(`${API_CONFIG.webBackendBaseUrl}/api/return-requests/reasons`, {
          headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error("Failed to fetch reasons");
        const data: string[] = await res.json();
        const mapped = data.map((id) => ({
          id,
          labelEn: REASONS_MAP[id]?.labelEn || id,
          labelVi: REASONS_MAP[id]?.labelVi || id
        }));
        setReasons(mapped);
      } catch (err) {
        console.error("Error fetching reasons:", err);
        // Fallback
        setReasons(
          Object.entries(REASONS_MAP).map(([id, val]) => ({
            id,
            ...val
          }))
        );
      }
    };
    fetchReasons();
  }, []);

  useEffect(() => {
    if (currentUser?.payment_methods && currentUser.payment_methods.length > 0 && !selectedPaymentMethodId) {
      setSelectedPaymentMethodId(currentUser.payment_methods[0].id);
    }
  }, [currentUser, selectedPaymentMethodId]);

  // Scroll to top on step changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStep]);

  const getSelectedPaymentMethodLabel = () => {
    if (!currentUser || !currentUser.payment_methods) {
      if (selectedPaymentMethodId.toLowerCase().includes("paypal")) {
        return "PayPal Account";
      }
      return selectedPaymentMethodId || "PayPal Account";
    }
    const pm = currentUser.payment_methods.find(
      (p: any) => p.id === selectedPaymentMethodId || p.paymentMethodId === selectedPaymentMethodId
    );
    if (!pm) {
      if (selectedPaymentMethodId.toLowerCase().includes("paypal")) {
        return "PayPal Account";
      }
      return selectedPaymentMethodId || "PayPal Account";
    }
    return pm.source === "paypal"
      ? "PayPal Account"
      : pm.source === "credit_card"
        ? `${pm.brand || "Credit Card"} Ending in ${pm.last_four || "XXXX"}`
        : "Gift Card";
  };

  // Retrieve user orders from live database
  const availableOrders = orders.map((ord) => ({
    id: ord.order_id,
    label: locale === "vi" ? `Đơn hàng #${ord.order_id} (${ord.date?.split(" ")[0] || ""})` : `Order #${ord.order_id} (${ord.date?.split(" ")[0] || ""})`
  }));

  // Selected order details helper
  const getSelectedOrderDetails = () => {
    const realOrder = orders.find(ord => ord.order_id === selectedOrderId);
    if (!realOrder) return null;

    return {
      order_id: realOrder.order_id,
      status: realOrder.status,
      date: realOrder.date,
      total: realOrder.total,
      items: realOrder.items.map((item, index): ReturnPageItem => {
        const isEligible = true;
        let imageUrl = IMAGES.keyboard;
        const n = item.name.toLowerCase();
        if (n.includes("mouse") || n.includes("chuột")) {
          imageUrl = IMAGES.mouse;
        } else if (n.includes("bottle") || n.includes("bình")) {
          imageUrl = "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=350&auto=format&fit=crop&q=80";
        } else if (n.includes("chair") || n.includes("ghế")) {
          imageUrl = "https://images.unsplash.com/photo-1505797149-43b0069ec26b?w=350&auto=format&fit=crop&q=80";
        } else if (n.includes("camera") || n.includes("máy ảnh")) {
          imageUrl = "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=350&auto=format&fit=crop&q=80";
        } else if (n.includes("kettle") || n.includes("ấm")) {
          imageUrl = "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=350&auto=format&fit=crop&q=80";
        } else if (n.includes("bookshelf") || n.includes("kệ")) {
          imageUrl = "https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=350&auto=format&fit=crop&q=80";
        } else {
          imageUrl = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=350&auto=format&fit=crop&q=80";
        }

        return {
          item_id: item.item_id || `${item.product_id}-${index}`,
          product_id: item.product_id,
          name: item.name,
          nameEn: item.name,
          options: item.options,
          price: item.price,
          image: imageUrl,
          eligible: isEligible,
          reason: !isEligible ? "Quá thời hạn đổi trả (7 ngày)" : undefined,
          reasonEn: !isEligible ? "Return period expired (7 days)" : undefined
        };
      })
    };
  };

  const orderDetails = getSelectedOrderDetails();

  // Reset selected items when order changes
  useEffect(() => {
    if (orderDetails) {
      const firstEligible = orderDetails.items.find((item) => item.eligible);
      if (firstEligible) {
        setSelectedItems({ [firstEligible.item_id]: true });
      } else {
        setSelectedItems({});
      }
    }
  }, [selectedOrderId]);

  // Calculate refund sum
  const refundTotal = orderDetails
    ? orderDetails.items
      .filter((item) => selectedItems[item.item_id])
      .reduce((sum, item) => sum + item.price, 0)
    : 0;

  // Toggle item selection
  const handleToggleItem = (itemId: string, eligible: boolean) => {
    if (!eligible) return;
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files);
    const newPreviews = filesArray.map(file => URL.createObjectURL(file));

    setEvidenceFiles((prev) => [...prev, ...filesArray]);
    setEvidencePreviews((prev) => [...prev, ...newPreviews]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDropzoneClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Delete evidence file
  const handleDeleteEvidenceFile = (index: number) => {
    URL.revokeObjectURL(evidencePreviews[index]);
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== index));
    setEvidencePreviews((prev) => prev.filter((_, i) => i !== index));
    toast.info(locale === "vi" ? "Đã xoá minh chứng." : "Deleted evidence.");
  };

  // Step 1 Validation & Next Step
  const handleStep1Continue = () => {
    const selectedCount = Object.values(selectedItems).filter(Boolean).length;
    if (selectedCount === 0) {
      toast.error(locale === "vi" ? "Vui lòng chọn ít nhất 1 sản phẩm hợp lệ." : "Please select at least 1 eligible product.");
      return;
    }
    if (!returnReason) {
      toast.error(locale === "vi" ? "Vui lòng chọn lý do trả hàng." : "Please select a return reason.");
      return;
    }
    if (requestType === "RETURN" && !selectedPaymentMethodId) {
      toast.error(locale === "vi" ? "Vui lòng chọn phương án hoàn tiền." : "Please select a refund payment method.");
      return;
    }
    setCurrentStep(2);
  };

  // Step 2 Validation & Next Step
  const handleStep2Continue = () => {
    setCurrentStep(3);
  };

  // Submit request (Step 3 to Step 4)
  const handleSubmitReturnRequest = async () => {
    const loadToast = toast.loading(locale === "vi" ? "Đang xử lý yêu cầu..." : "Processing request...");

    try {
      const token = localStorage.getItem("store:token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Upload all files to Cloudinary sequentially without showing specific upload toasts
      const uploadedUrls: string[] = [];
      for (let i = 0; i < evidenceFiles.length; i++) {
        const file = evidenceFiles[i];
        const formData = new FormData();
        formData.append("file", file);

        const uploadRes = await fetch(`${API_CONFIG.webBackendBaseUrl}/api/return-requests/upload`, {
          method: "POST",
          headers,
          body: formData
        });

        if (!uploadRes.ok) {
          throw new Error(locale === "vi" ? `Không thể tải tệp lên hệ thống.` : `Failed to upload file.`);
        }

        const data = await uploadRes.json();
        uploadedUrls.push(data.url);
      }

      const payload = {
        order_id: selectedOrderId,
        type: requestType,
        reason: returnReason,
        payment_method_id: requestType === "RETURN" ? selectedPaymentMethodId : undefined,
        item_ids: Object.keys(selectedItems).filter(id => selectedItems[id]),
        customer_comment: description,
        images: uploadedUrls
      };

      const requestHeaders: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (token) {
        requestHeaders["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_CONFIG.webBackendBaseUrl}/api/return-requests`, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Failed to submit return request");
      }

      const responseData = await res.json();
      console.log("Successfully created return request:", responseData);

      // Clean up local preview object URLs to release memory
      evidencePreviews.forEach(url => URL.revokeObjectURL(url));
      setEvidenceFiles([]);
      setEvidencePreviews([]);

      toast.dismiss(loadToast);
      setCurrentStep(4);

      if (refreshReturnRequests) {
        await refreshReturnRequests();
      }

      toast.success(locale === "vi" ? "Gửi yêu cầu trả hàng thành công!" : "Return request submitted successfully!");
    } catch (err: any) {
      toast.dismiss(loadToast);
      console.error("Error submitting return request:", err);
      toast.error(locale === "vi" ? `Không thể gửi yêu cầu: ${err.message}` : `Failed to submit: ${err.message}`);
    }
  };

  // Reset form
  const handleCancelRequest = () => {
    if (orderDetails) {
      const firstEligible = orderDetails.items.find((item) => item.eligible);
      setSelectedItems(firstEligible ? { [firstEligible.item_id]: true } : {});
    }
    setReturnReason("");
    setDescription("");
    evidencePreviews.forEach(url => URL.revokeObjectURL(url));
    setEvidenceFiles([]);
    setEvidencePreviews([]);
    setCurrentStep(1);
    toast.info(locale === "vi" ? "Đã hủy bỏ thao tác." : "Request cancelled.");
  };

  const formatPrice = (amount: number) => {
    if (locale === "vi") {
      return (amount * 25000).toLocaleString("vi-VN") + " đ";
    }
    return `$${amount.toFixed(2)}`;
  };

  return (
    <div className={`bg-white border border-slate-200 rounded-3xl ${spacing.cardPadding} shadow-2xs ${spacing.sectionGap} animate-in fade-in duration-300`}>

      {/* Title Header */}
      <div className="space-y-1.5 text-left">
        <h1 className="text-2xl font-black tracking-tight text-slate-900 font-display">
          {t("returnRefundRequest")}
        </h1>
        <p className="text-xs text-slate-500 leading-relaxed max-w-lg font-medium">
          {t("returnRefundRequestDesc")}
        </p>
      </div>



      {/* STEP 1: CHOOSE ORDER AND PRODUCT */}
      {currentStep === 1 && (
        <div className="space-y-6 animate-in fade-in duration-300">

          {/* Order Select Dropdown */}
          {!isLocked && (
            <div className="space-y-1.5 text-left">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                {t("selectOrderToReturn")}
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowOrderDropdown(!showOrderDropdown)}
                  className="w-full bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-left text-xs font-semibold text-slate-700 flex items-center justify-between outline-none focus:ring-2 focus:ring-[#ff4e20]/25 transition-all"
                >
                  <span>
                    {availableOrders.find((ord) => ord.id === selectedOrderId)?.label || t("selectRecentOrder")}
                  </span>
                  <ChevronDown className="size-4 text-slate-400" />
                </button>

                {showOrderDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden py-1 divide-y divide-slate-50 animate-in fade-in-40 duration-200">
                    {availableOrders.map((ord) => (
                      <button
                        key={ord.id}
                        type="button"
                        onClick={() => {
                          setSelectedOrderId(ord.id);
                          setShowOrderDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors hover:bg-orange-50/50 hover:text-orange-700 ${selectedOrderId === ord.id ? "bg-orange-50/30 text-orange-600 font-bold" : "text-slate-600"
                          }`}
                      >
                        {ord.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Product checkbox items list */}
          <div className="space-y-2.5 text-left">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              {t("selectProducts")}
            </label>

            {orderDetails ? (
              <div className="space-y-3">
                {orderDetails.items.map((item) => {
                  const isChecked = !!selectedItems[item.item_id];
                  return (
                    <div
                      key={item.item_id}
                      onClick={() => handleToggleItem(item.item_id, item.eligible)}
                      className={`border rounded-xl p-4 flex items-start gap-4 transition-all ${!item.eligible
                        ? "bg-slate-50/60 border-slate-200 opacity-75 cursor-not-allowed select-none"
                        : isChecked
                          ? `border-[#ff4e20] ${colors.primaryBgLight} shadow-3xs cursor-pointer`
                          : "border-slate-200 hover:border-slate-300 bg-white cursor-pointer"
                        }`}
                    >
                      {/* Checkbox */}
                      <div className="pt-0.5 shrink-0">
                        {item.eligible ? (
                          <div
                            className={`h-4.5 w-4.5 rounded flex items-center justify-center border transition-all ${isChecked
                              ? `${colors.primaryBg} border-transparent text-white`
                              : "border-slate-300 bg-white hover:border-slate-400"
                              }`}
                          >
                            {isChecked && <Check className="size-3 stroke-[3]" />}
                          </div>
                        ) : (
                          <div className="h-4.5 w-4.5 rounded border border-slate-200 bg-slate-100 flex items-center justify-center cursor-not-allowed" />
                        )}
                      </div>

                      {/* Product image placeholder */}
                      <div className="h-12 w-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shrink-0 select-none">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-package size-5 stroke-[1.5]">
                          <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"></path>
                          <path d="M12 22V12"></path>
                          <polyline points="3.29 7 12 12 20.71 7"></polyline>
                          <path d="m7.5 4.27 9 5.15"></path>
                        </svg>
                      </div>


                      {/* Product Name & Specs */}
                      <div className="flex-grow space-y-1 min-w-0">
                        <h4 className="font-extrabold text-[13px] text-slate-800 leading-snug truncate">
                          {locale === "vi" ? item.name : item.nameEn}
                        </h4>

                        <div className="text-[10px] text-slate-400 font-medium">
                          {item.options && Object.entries(item.options).map(([k, v]) => (
                            <span key={k} className="mr-3">
                              {k === "Phân loại" ? (locale === "vi" ? "Phân loại" : "Option") : k}: {v}
                            </span>
                          ))}
                        </div>

                        {/* Warning when ineligible */}
                        {!item.eligible && (
                          <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1.5 mt-0.5">
                            <AlertCircle className="size-3" />
                            <span>{locale === "vi" ? item.reason : item.reasonEn}</span>
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] font-bold text-slate-400">
                            {locale === "vi" ? "SL: 1" : "Qty: 1"}
                          </span>
                          <span className="text-xs font-black text-orange-655">
                            {formatPrice(item.price)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 border border-dashed rounded-xl text-xs text-slate-400">
                {t("noProductsAvailable")}
              </div>
            )}
          </div>

          {/* Reason select dropdown */}
          <div className="space-y-1.5 text-left">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              {t("reasonForReturn")}
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowReasonDropdown(!showReasonDropdown)}
                className="w-full bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-left text-xs font-semibold text-slate-700 flex items-center justify-between outline-none focus:ring-2 focus:ring-[#ff4e20]/25 transition-all"
              >
                <span>
                  {reasons.find((r) => r.id === returnReason)
                    ? locale === "vi"
                      ? reasons.find((r) => r.id === returnReason)?.labelVi
                      : reasons.find((r) => r.id === returnReason)?.labelEn
                    : t("selectReason")}
                </span>
                <ChevronDown className="size-4 text-slate-400" />
              </button>

              {showReasonDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden py-1 divide-y divide-slate-50 animate-in fade-in-40 duration-200">
                  {reasons.map((reason) => (
                    <button
                      key={reason.id}
                      type="button"
                      onClick={() => {
                        setReturnReason(reason.id);
                        setShowReasonDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors hover:bg-orange-50/50 hover:text-orange-700 ${returnReason === reason.id ? "bg-orange-50/30 text-orange-600 font-bold" : "text-slate-600"
                        }`}
                    >
                      {locale === "vi" ? reason.labelVi : reason.labelEn}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Description text area */}
          <div className="space-y-1.5 text-left">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              {t("detailedDescription")}
            </label>
            <textarea
              rows={4}
              placeholder={t("provideMoreDetailsPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-xs border border-slate-200 focus:border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#ff4e20]/20 transition-all text-slate-800 font-medium"
            />
          </div>

          {/* Refund Method Selection - Below Detailed Description */}
          {requestType === "RETURN" && currentUser && currentUser.payment_methods && currentUser.payment_methods.length > 0 && (
            <div className="space-y-3 text-left">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                {locale === "vi" ? "Phương án nhận tiền hoàn" : "Refund Payment Method"}
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentUser.payment_methods.map((pm) => {
                  const isSelected = selectedPaymentMethodId === pm.id;
                  return (
                    <button
                      type="button"
                      key={pm.id}
                      onClick={() => setSelectedPaymentMethodId(pm.id)}
                      className={`p-4 border rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between h-20 ${isSelected
                        ? `border-[#ff4e20] ${colors.primaryBgLight} shadow-3xs`
                        : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                    >
                      <span className="block font-bold text-xs text-slate-800 capitalize truncate">
                        {pm.source === "paypal" ? "PayPal Account" : pm.source === "credit_card" ? `${pm.brand || "Credit Card"} Ending in ${pm.last_four || "XXXX"}` : `Gift Card`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Evidence dropzone upload */}
          <div className="space-y-3.5 text-left">
            <div>
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                {t("imageVideoEvidence")}
              </label>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                {t("uploadEvidenceDesc")}
              </p>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept="image/*"
              className="hidden"
            />
            <div
              onClick={handleDropzoneClick}
              className="border-2 border-dashed border-orange-200 hover:border-orange-400 bg-orange-50/5 hover:bg-orange-50/15 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
            >
              <div className="h-10 w-10 rounded-full bg-orange-50 group-hover:scale-105 transition-transform flex items-center justify-center text-orange-500 shadow-3xs">
                <UploadCloud className="size-5.5" />
              </div>
              <div className="text-xs font-bold text-slate-700">
                {t("dragDropBrowse")}
              </div>
              <p className="text-[10px] text-slate-400 font-semibold">
                {t("fileSizeLimit")}
              </p>
            </div>

            {evidencePreviews.length > 0 && (
              <div className="flex flex-wrap gap-3 pt-1">
                {evidencePreviews.map((file, idx) => (
                  <div
                    key={idx}
                    className="h-16 w-16 rounded-xl border border-slate-200 overflow-hidden relative group/thumb shadow-2xs"
                  >
                    <img
                      src={file}
                      alt="Evidence thumbnail"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEvidenceFile(idx);
                      }}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-white transition-opacity duration-200 cursor-pointer"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom navigation buttons */}
          <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3.5">
            <button
              type="button"
              onClick={handleCancelRequest}
              className="border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold py-2.5 px-6 rounded-xl transition-all cursor-pointer"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleStep1Continue}
              className="bg-[#ff4e20] hover:bg-[#e0431b] text-white text-xs font-extrabold py-2.5 px-6 rounded-xl shadow-md transition-all cursor-pointer"
            >
              {t("continueBtn")}
            </button>
          </div>

        </div>
      )}

      {/* STEP 2: LOGISTICS & REFUND DESTINATION */}
      {currentStep === 2 && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <h3 className="font-extrabold text-sm text-slate-800 border-b pb-2 text-left">
            {t("refundReturnMethods")}
          </h3>

          {/* Claim type selection (Return vs Exchange) */}
          <div className="space-y-3 text-left">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              {locale === "vi" ? "Phân loại yêu cầu" : "Claim Request Type"}
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRequestType("RETURN")}
                className={`p-4 border rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between h-24 ${requestType === "RETURN"
                  ? `border-[#ff4e20] ${colors.primaryBgLight} shadow-3xs`
                  : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
              >
                <span className="block font-bold text-[13px] text-slate-800">
                  {locale === "vi" ? "Trả hàng & Hoàn tiền" : "Return & Refund"}
                </span>
                <span className="block text-[10px] text-slate-400 leading-normal font-medium mt-1">
                  {locale === "vi"
                    ? "Nhận lại tiền hoàn trả vào tài khoản ví hoặc ngân hàng sau khi trả hàng thành công."
                    : "Receive your money back to store wallet or bank transfer after item return is processed."}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setRequestType("EXCHANGE")}
                className={`p-4 border rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between h-24 ${requestType === "EXCHANGE"
                  ? `border-[#ff4e20] ${colors.primaryBgLight} shadow-3xs`
                  : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
              >
                <span className="block font-bold text-[13px] text-slate-800">
                  {locale === "vi" ? "Đổi hàng lấy sản phẩm mới" : "Exchange for New Item"}
                </span>
                <span className="block text-[10px] text-slate-400 leading-normal font-medium mt-1">
                  {locale === "vi"
                    ? "Đổi sản phẩm lỗi/không vừa sang một sản phẩm mới cùng loại."
                    : "Swap your wrong/defective item for a brand new replacement of the same type."}
                </span>
              </button>
            </div>
          </div>

          {/* Logistics selection */}
          <div className="space-y-3 text-left">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              {t("returnLogistics")}
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPickupMethod("home")}
                className={`p-4 border rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between h-24 ${pickupMethod === "home"
                  ? `border-[#ff4e20] ${colors.primaryBgLight} shadow-3xs`
                  : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
              >
                <span className="block font-bold text-[13px] text-slate-800">
                  {t("homePickup")}
                </span>
                <span className="block text-[10px] text-slate-400 leading-normal font-medium mt-1">
                  {t("homePickupDesc")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPickupMethod("dropoff")}
                className={`p-4 border rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between h-24 ${pickupMethod === "dropoff"
                  ? `border-[#ff4e20] ${colors.primaryBgLight} shadow-3xs`
                  : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
              >
                <span className="block font-bold text-[13px] text-slate-800">
                  {t("dropoffPostOffice")}
                </span>
                <span className="block text-[10px] text-slate-400 leading-normal font-medium mt-1">
                  {t("dropoffPostOfficeDesc")}
                </span>
              </button>
            </div>
          </div>

          {/* Chosen refund method review */}
          {requestType === "RETURN" && selectedPaymentMethodId && currentUser && (
            <div className="space-y-3 text-left">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                {locale === "vi" ? "Phương án nhận tiền hoàn" : "Refund Destination"}
              </label>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex justify-between items-center text-xs font-semibold text-slate-700">
                <span className="capitalize">
                  {(() => {
                    const pm = currentUser.payment_methods.find(p => p.id === selectedPaymentMethodId);
                    if (!pm) return `Payment Method (${selectedPaymentMethodId})`;
                    return pm.source === "paypal" ? "PayPal Account" : pm.source === "credit_card" ? `${pm.brand || "Credit Card"} ending in ${pm.last_four || "XXXX"}` : "Gift Card";
                  })()}
                </span>
                <span className="font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-bold">
                  {selectedPaymentMethodId}
                </span>
              </div>
            </div>
          )}

          {/* Refund Summary box */}
          {requestType === "RETURN" && (
            <div className={`${colors.primaryBgLight} border ${colors.primaryBorder} rounded-2xl p-5 text-left space-y-3.5`}>
              <h4 className="font-extrabold text-[12px] text-slate-800 uppercase tracking-wider">
                {t("refundSummary")}
              </h4>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="pb-2.5 flex justify-between">
                  <span className="text-slate-500">{t("itemsRefundSubtotal")}</span>
                  <span className="font-bold text-slate-800">{formatPrice(refundTotal)}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-500">{t("returnShippingFee")}</span>
                  <span className="font-bold text-emerald-600">{t("free")}</span>
                </div>
                <div className="pt-2.5 flex justify-between font-bold text-sm">
                  <span className="text-slate-800">{t("totalEstimatedRefund")}</span>
                  <span className={`text-[#ff4e20] ${colors.primaryText} font-black`}>{formatPrice(refundTotal)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3.5">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold py-2.5 px-6 rounded-xl transition-all cursor-pointer"
            >
              {t("back")}
            </button>
            <button
              type="button"
              onClick={handleStep2Continue}
              className={`${colors.primaryBg} ${colors.primaryBgHover} text-white text-xs font-extrabold py-2.5 px-6 rounded-xl shadow-md transition-all cursor-pointer`}
            >
              {t("continueBtn")}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: CONFIRM & SUBMIT */}
      {currentStep === 3 && (
        <div className="space-y-6 animate-in fade-in duration-300 text-left">
          <h3 className="font-extrabold text-sm text-slate-800 border-b pb-2">
            {t("confirmRequestDetails")}
          </h3>

          <div className="space-y-4 text-xs font-medium">
            <div className="space-y-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">{t("returnedItems")}</span>
              <div className="border border-slate-100 rounded-xl divide-y divide-slate-50 bg-slate-50/30 p-1">
                {orderDetails?.items
                  .filter((item) => selectedItems[item.item_id])
                  .map((item) => (
                    <div key={item.item_id} className="p-3 flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-800 truncate max-w-xs">
                        {locale === "vi" ? item.name : item.nameEn}
                      </span>
                      <span className="font-bold text-slate-700 shrink-0">{formatPrice(item.price)}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">{t("reasonForReturn")}</span>
                <p className="font-semibold text-slate-800">
                  {reasons.find((r) => r.id === returnReason)
                    ? locale === "vi"
                      ? reasons.find((r) => r.id === returnReason)?.labelVi
                      : reasons.find((r) => r.id === returnReason)?.labelEn
                    : ""}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">{t("refundMethodLabel")}</span>
                <p className="font-semibold text-slate-800 capitalize">
                  {getSelectedPaymentMethodLabel()}
                </p>
              </div>
            </div>

            {/* Logistics Address */}
            <div className="space-y-1 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">{t("returnShippingAddress")}</span>
              {currentUser ? (
                <div className="font-medium text-slate-700 mt-1 leading-relaxed">
                  <strong>{currentUser.first_name} {currentUser.last_name}</strong>
                  <br />
                  {currentUser.address.address1}, {currentUser.address.city}, {currentUser.address.state} {currentUser.address.zip}
                </div>
              ) : (
                <div className="font-medium text-slate-700 mt-1 leading-relaxed">
                  <strong>Demo Customer</strong>
                  <br />
                  72 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh
                </div>
              )}
            </div>

            {/* Confirm checkbox */}
            <div className="flex items-start gap-2.5 pt-3 select-none">
              <input
                type="checkbox"
                id="ack-confirm-sub"
                className="mt-0.5 rounded accent-[#ff4e20]"
                defaultChecked
              />
              <label htmlFor="ack-confirm-sub" className="text-[11px] text-slate-500 leading-normal font-medium cursor-pointer">
                {t("returnAcknowledgement")}
              </label>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3.5">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold py-2.5 px-6 rounded-xl transition-all cursor-pointer"
            >
              {t("back")}
            </button>
            <button
              type="button"
              onClick={handleSubmitReturnRequest}
              className={`${colors.primaryBg} ${colors.primaryBgHover} text-white text-xs font-extrabold py-2.5 px-6 rounded-xl shadow-md transition-all cursor-pointer`}
            >
              {t("submitRequest")}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: SUCCESS */}
      {currentStep === 4 && (
        <div className="text-center py-10 space-y-6 animate-in zoom-in-95 duration-350">
          <div className={`h-16 w-16 ${colors.successBg} rounded-full flex items-center justify-center ${colors.successText} mx-auto shadow-sm`}>
            <ShieldCheck className="size-9 stroke-[2.2]" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-800">
              {t("returnSuccessTitle")}
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto font-medium">
              {t("returnSuccessDesc")}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 max-w-xs mx-auto text-left space-y-1.5 text-xs font-semibold">
            <div className="flex justify-between">
              <span className="text-slate-400 font-semibold">{t("requestIdLabel")}</span>
              <strong className="font-mono text-slate-800">RET-827419</strong>
            </div>
            <div className="flex justify-between flex-wrap gap-2">
              <span className="text-slate-400 font-semibold">{t("refundTypeLabel")}</span>
              <strong className="text-slate-800 capitalize">{getSelectedPaymentMethodLabel()}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-semibold">{t("refundTotalLabel")}</span>
              <strong className={`${colors.primaryText} font-black`}>{formatPrice(refundTotal)}</strong>
            </div>
          </div>

          <div className="pt-4 flex justify-center">
            <Link
              href="/account?tab=orders&subTab=returns"
              className="inline-flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-white text-xs font-black px-6 py-3 rounded-2xl shadow-sm hover:scale-102 transition-all cursor-pointer select-none text-center"
            >
              <span>{locale === "vi" ? "Xem yêu cầu đổi trả" : "View Return Requests"}</span>
            </Link>
          </div>
        </div>
      )}

    </div>
  );
}
