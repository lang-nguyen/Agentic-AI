import React, { useState } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { useLocale } from "@/contexts/locale.context";
import { MOCK_USERS } from "@/data/mockData";
import { spacing, colors, typography } from "@/theme/user";
import {
  MapPin,
  CreditCard,
  User,
  ArrowRight,
  Search,
  Lock
} from "lucide-react";
import { toast } from "sonner";

export interface ProfileTabProps {
  onTabChange: (tab: "profile" | "orders" | "returns") => void;
}

export function ProfileTab({ onTabChange }: ProfileTabProps) {
  const { currentUser, login } = useAuth();
  const { locale, t } = useLocale();
  const [customEmail, setCustomEmail] = useState("");

  const handleSelectUser = (key: string) => {
    login(key);
  };

  const handleCustomEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const emailToSearch = customEmail.trim().toLowerCase();
    if (!emailToSearch) return;

    const userKey = Object.keys(MOCK_USERS).find(
      (key) => MOCK_USERS[key].email.toLowerCase() === emailToSearch
    );

    if (userKey) {
      login(userKey);
      setCustomEmail("");
    } else {
      toast.error(locale === "vi" ? "Không tìm thấy email này trong cơ sở dữ liệu!" : "No user found with this email in the database!");
    }
  };

  if (!currentUser) {
    return (
      <div className={`bg-white border border-slate-200/60 rounded-3xl ${spacing.cardPadding} shadow-sm text-center py-20 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-200`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        <p className="text-xs text-slate-400 font-semibold">
          {locale === "vi" ? "Đang tải thông tin tài khoản" : "Loading account data..."}
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-slate-200/60 rounded-3xl ${spacing.cardPadding} shadow-sm ${spacing.sectionGap} text-left animate-in fade-in duration-350`}>

      <div className="space-y-1">
        <h2 className={typography.titleSection}>
          {t("profileDetails")}
        </h2>
        <p className={typography.bodyMuted}>
          {t("profileDetailsDesc")}
        </p>
      </div>

      <div className={`bg-white border border-slate-200 rounded-2xl ${spacing.cardPaddingDense} shadow-3xs ${spacing.elementGap}`}>
        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
          <div>
            <span className={`${typography.labelUppercaseDense} block`}>
              {t("accountInfo")}
            </span>
            <h4 className={typography.bodyMain}>
              {currentUser.first_name} {currentUser.last_name}
            </h4>
          </div>
          <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase border bg-orange-50 border-orange-200 text-orange-700">
            {t("member")}
          </span>
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${typography.bodyMain}`}>
          <div className="leading-tight">
            <span className="text-slate-455 block text-[10px] font-bold">Email:</span>
            <span className="text-slate-800 font-bold block mt-1">{currentUser.email}</span>
          </div>
          <div className="leading-tight">
            <span className="text-slate-455 block text-[10px] font-bold">ID:</span>
            <span className="text-slate-800 font-mono font-bold block mt-1">{currentUser.id}</span>
          </div>
        </div>
      </div>

      <div className={`bg-white border border-slate-200 rounded-2xl ${spacing.cardPaddingDense} shadow-3xs ${spacing.elementGap}`}>
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <MapPin className={`size-4 ${colors.primaryText}`} />
          <h4 className={`${typography.labelUppercase} text-slate-850`}>
            {t("defaultShippingAddress")}
          </h4>
        </div>

        <div className={`space-y-1.5 ${typography.bodyMain}`}>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-semibold">{t("recipientName")}</span>
            <span className="text-slate-800 font-bold">{currentUser.first_name} {currentUser.last_name}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-semibold">{t("addressLine1")}</span>
            <span className="text-slate-800 font-bold">{currentUser.address.address1}</span>
          </div>

          {currentUser.address.address2 && (
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-semibold">{t("addressLine2")}</span>
              <span className="text-slate-800 font-bold">{currentUser.address.address2}</span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-semibold">{t("cityState")}</span>
            <span className="text-slate-800 font-bold">{currentUser.address.city}, {currentUser.address.state}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-semibold">{t("postalCode")}</span>
            <span className="text-slate-800 font-mono font-bold">{currentUser.address.zip}</span>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
            <span className="text-slate-500 font-semibold">{t("country")}</span>
            <span className="text-slate-800 font-black block text-[10px] uppercase">{currentUser.address.country}</span>
          </div>
        </div>
      </div>

      <div className={`bg-white border border-slate-200 rounded-2xl ${spacing.cardPaddingDense} shadow-3xs ${spacing.elementGap}`}>
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <CreditCard className={`size-4 ${colors.primaryText}`} />
          <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
            {t("linkedPaymentMethods")}
          </h4>
        </div>

        <div className="space-y-3">
          {currentUser.payment_methods.length > 0 ? (
            currentUser.payment_methods.map((method) => (
              <div
                key={method.id}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs font-semibold"
              >
                <div className="flex items-center gap-2">
                  <span className={`capitalize font-extrabold text-[9px] ${colors.primaryText} ${colors.primaryBgLight} border ${colors.primaryBorder} px-2 py-0.5 rounded-lg select-none`}>
                    {method.source === "credit_card" ? (locale === "vi" ? "Thẻ Tín Dụng" : "Credit Card") : method.source}
                  </span>
                  <span className="font-mono text-slate-800 block">
                    {method.brand ? `${method.brand.toUpperCase()} ending in •••• ${method.last_four}` : method.id}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 select-none">
                  {t("active")}
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 italic text-center py-2">
              No payment methods linked to this profile.
            </p>
          )}
        </div>
      </div>

      {/* Footer redirection guide link */}
      <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-xs">
        <span className="text-slate-500 font-semibold">{t("needCheckReceipts")}</span>
        <button
          onClick={() => onTabChange("orders")}
          className="font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 hover:underline cursor-pointer"
        >
          <span>{t("viewOrderHistory")}</span>
          <ArrowRight className="size-3.5" />
        </button>
      </div>

    </div>
  );
}
