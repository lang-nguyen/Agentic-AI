"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/useAuth";
import { useLocale } from "@/contexts/locale.context";
import { ClientLayout } from "@/components/user/layout/ClientLayout";
import { User, Lock, ArrowRight, ShieldCheck, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { colors } from "@/theme/user";

export default function LoginForm() {
  const { login, currentUser, loading } = useAuth();
  const { locale } = useLocale();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Redirect to home page reactively when authenticated
  useEffect(() => {
    if (currentUser) {
      router.replace("/");
    }
  }, [currentUser, router]);

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error(locale === "vi" ? "Vui lòng nhập đầy đủ thông tin!" : "Please fill in all fields!");
      return;
    }

    const success = await login(username.trim(), password.trim());
    if (success) {
      router.replace("/");
    }
  };

  const handleQuickLogin = async (userKey: string) => {
    const success = await login(userKey, "abc@123");
    if (success) {
      router.replace("/");
    }
  };

  return (
    <ClientLayout>
      <div className="bg-[#f8fafc] min-h-screen py-20 flex items-center justify-center text-left">
        <div className="max-w-md w-full mx-4 bg-white/70 backdrop-blur-md border border-slate-200/60 rounded-3xl p-8 shadow-xl space-y-8 animate-in fade-in zoom-in-95 duration-300">

          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">
              {locale === "vi" ? "Đăng Nhập Laki Store" : "Sign In to Laki Store"}
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              {locale === "vi" ? "Sử dụng tài khoản hệ thống hoặc chọn truy cập nhanh" : "Use system credentials or choose quick access"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleManualLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {locale === "vi" ? "Email hoặc ID người dùng" : "Email or User ID"}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={locale === "vi" ? "VD: ivan_santos_6635" : "e.g., ivan_santos_6635"}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 font-medium placeholder-slate-400 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all"
                  disabled={loading}
                />
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {locale === "vi" ? "Mật khẩu" : "Password"}
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 font-medium placeholder-slate-400 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all"
                  disabled={loading}
                />
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 ${colors.primaryGradient} ${colors.primaryGradientHover} text-white font-extrabold text-xs rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50`}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <>
                  <span>{locale === "vi" ? "Đăng Nhập" : "Sign In"}</span>
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex py-1 items-center select-none">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-4 text-[9px] font-bold uppercase tracking-widest text-slate-400">
              {locale === "vi" ? "Hoặc Đăng Nhập Nhanh" : "Or Quick Access"}
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Quick Login Cards */}
          <div className="grid grid-cols-1 gap-3">

            {/* Noah Brown - Admin */}
            <button
              type="button"
              onClick={() => handleQuickLogin("noah_brown_6181")}
              disabled={loading}
              className="flex items-center justify-between p-4 border border-slate-200/80 hover:border-orange-300 hover:bg-orange-50/20 rounded-2xl text-left transition-all group cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full ${colors.primaryGradientTr} text-white flex items-center justify-center text-xs font-black shadow-xs shrink-0`}>
                  NB
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span>Noah Brown</span>
                    <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 text-[8px] font-extrabold uppercase rounded-md tracking-wider flex items-center gap-0.5 select-none">
                      <ShieldCheck className="size-2.5" />
                      <span>Admin</span>
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                    {locale === "vi" ? "Quản lý sản phẩm, đơn hàng & đổi trả" : "Manage products, orders & returns"}
                  </p>
                </div>
              </div>
              <ArrowRight className="size-4 text-slate-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
            </button>

            {/* Ivan Santos - Customer */}
            <button
              type="button"
              onClick={() => handleQuickLogin("ivan_santos_6635")}
              disabled={loading}
              className="flex items-center justify-between p-4 border border-slate-200/80 hover:border-amber-300 hover:bg-amber-50/20 rounded-2xl text-left transition-all group cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-650 flex items-center justify-center text-xs font-black shrink-0">
                  IS
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span>Ivan Santos</span>
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[8px] font-extrabold uppercase rounded-md tracking-wider flex items-center gap-0.5 select-none">
                      <UserCheck className="size-2.5" />
                      <span>Customer</span>
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                    {locale === "vi" ? "Khách hàng mua sắm & đổi trả hàng" : "Browse catalog, shop & return orders"}
                  </p>
                </div>
              </div>
              <ArrowRight className="size-4 text-slate-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
            </button>

          </div>

        </div>
      </div>
    </ClientLayout>
  );
}
