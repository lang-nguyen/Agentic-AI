"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/useAuth";
import { useLocale } from "@/contexts/locale.context";
import { MOCK_ORDERS } from "@/data/mockData";
import { spacing } from "@/theme/user";
import {
  Flame,
  ChevronRight as ChevronRightIcon,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  User,
  ShoppingCart,
  Heart,
  Clock,
  Sparkles
} from "lucide-react";

export function HeroSection() {
  const { currentUser, logout } = useAuth();
  const { locale, t } = useLocale();
  const [currentSlide, setCurrentSlide] = useState(0);

  const localizedSlides = [
    {
      category: "Electronics",
      tagline: locale === "en" ? "DOUBLE 11 PRE-SALE" : "KHUYẾN MÃI DOUBLE 11",
      title: locale === "en" ? "Next-Gen Smart Electronics" : "Thiết bị điện tử thông minh mới",
      description: locale === "en" ? "Camera gear, smart watches, and mechanical keyboards at lowest sandbox rates." : "Máy ảnh, đồng hồ thông minh và bàn phím cơ với mức giá thử nghiệm tốt nhất.",
      ctaText: locale === "en" ? "Go Tech" : "Xem Đồ Công Nghệ",
      imageUrl: "https://images.unsplash.com/photo-1496181130204-755241544e35?w=600&auto=format&fit=crop&q=80"
    },
    {
      category: "Apparel",
      tagline: locale === "en" ? "NEW AUTUMN TRENDS" : "XU HƯỚNG MÙA THU MỚI",
      title: locale === "en" ? "Minimalist Outfits & Shoes" : "Trang phục & Giày tối giản",
      description: locale === "en" ? "Premium knitwear, running shoes, and cotton casuals for cold weather." : "Áo len cao cấp, giày chạy bộ và đồ cotton thông thường cho thời tiết lạnh.",
      ctaText: locale === "en" ? "Go Fashion" : "Xem Thời Trang",
      imageUrl: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80"
    },
    {
      category: "Home & Outdoor",
      tagline: locale === "en" ? "OUTDOOR REVOLUTION" : "CÁCH MẠNG DÃ NGOẠI",
      title: locale === "en" ? "Heavy Duty Hiking Gear" : "Dụng cụ dã ngoại siêu bền",
      description: locale === "en" ? "Waterproof canvas backpacks, smart utilities, and travel tools." : "Balo vải chống thấm nước, các tiện ích thông minh và dụng cụ du lịch.",
      ctaText: locale === "en" ? "Go Outdoors" : "Xem Đồ Dã Ngoại",
      imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80"
    }
  ];

  const localizedCategories = [
    { name: locale === "en" ? "Womenswear & Dress" : "Thời trang nữ & Đầm", icon: "👗", category: "Apparel" },
    { name: locale === "en" ? "Menswear & Casuals" : "Thời trang nam & Đồ thường", icon: "👔", category: "Apparel" },
    { name: locale === "en" ? "Footwear & Sports" : "Giày dép & Thể thao", icon: "👟", category: "Footwear" },
    { name: locale === "en" ? "Smart Electronics" : "Thiết bị điện tử thông minh", icon: "💻", category: "Electronics" },
    { name: locale === "en" ? "Bags & Suitcases" : "Túi xách & Vali", icon: "🎒", category: "Accessories" },
    { name: locale === "en" ? "Watches & Jewelry" : "Đồng hồ & Trang sức", icon: "⌚", category: "Accessories" },
    { name: locale === "en" ? "Home & Decor" : "Trang trí nhà cửa & Nội thất", icon: "🛋️", category: "Home & Outdoor" },
    { name: locale === "en" ? "Outdoor & Camping" : "Dã ngoại & Cắm trại", icon: "⛺", category: "Home & Outdoor" },
    { name: locale === "en" ? "Fresh Foods & Snacks" : "Thực phẩm tươi & Ăn vặt", icon: "🍎", category: "Electronics" },
    { name: locale === "en" ? "Stationery & Books" : "Sách & Văn phòng phẩm", icon: "📚", category: "Accessories" },
    { name: locale === "en" ? "Automotive & Tools" : "Ô tô & Dụng cụ sửa chữa", icon: "🚗", category: "Home & Outdoor" },
    { name: locale === "en" ? "Pet Supplies & Toys" : "Đồ dùng thú cưng & Đồ chơi", icon: "🐱", category: "Apparel" }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % localizedSlides.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [localizedSlides.length]);

  const handlePrevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + localizedSlides.length) % localizedSlides.length);
  };

  const handleNextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % localizedSlides.length);
  };

  const latestUserOrderId = currentUser?.orders?.[currentUser.orders.length - 1];
  const activeOrder = latestUserOrderId ? MOCK_ORDERS[latestUserOrderId] : null;

  return (
    <section className={`max-w-7xl mx-auto ${spacing.layoutPx} py-4 select-none`}>
      <div className={`grid grid-cols-1 lg:grid-cols-12 ${spacing.gridGap} items-stretch`}>
        <div className="hidden lg:flex lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-3.5 shadow-3xs text-left h-[380px] flex-col">
          <div className="flex items-center gap-1.5 border-b pb-1.5 mb-2.5 shrink-0">
            <Flame className="size-4 text-orange-600 animate-pulse" />
            <h3 className="font-extrabold text-[11px] text-slate-800 uppercase tracking-wider">
              {t("allCatalogs")}
            </h3>
          </div>
          <nav className="flex-1 overflow-y-auto scrollbar-pretty pr-1 grid grid-cols-1 gap-0.5">
            {localizedCategories.map((cat) => (
              <Link
                key={cat.name}
                href={`/shop?category=${cat.category}`}
                className="flex items-center justify-between px-2.5 pt-1 pb-1.5 rounded-lg hover:bg-orange-50 hover:text-orange-600 text-slate-700 font-semibold transition-all text-xs group"
              >
                <div className="flex items-center">
                  <span className="truncate max-w-[150px]">{cat.name}</span>
                </div>
                <ChevronRightIcon className="size-3 text-slate-355 group-hover:text-orange-600 transition-colors" />
              </Link>
            ))}
          </nav>
        </div>

        <div className="lg:col-span-6 flex flex-col justify-between gap-4 h-[380px]">
          <div className="relative flex-grow h-[220px] bg-slate-100 border border-slate-200 rounded-2xl overflow-hidden shadow-3xs flex items-center">
            <img
              src={localizedSlides[currentSlide].imageUrl}
              alt={localizedSlides[currentSlide].title}
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/80 to-transparent" />

            <div className="relative z-10 p-6 max-w-sm space-y-3.5 text-left">
              <span className="inline-flex items-center gap-1 bg-orange-600 text-white text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                <Sparkles className="size-2.5" />
                {localizedSlides[currentSlide].tagline}
              </span>

              <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                {localizedSlides[currentSlide].title}
              </h2>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                {localizedSlides[currentSlide].description}
              </p>

              <Link
                href={`/shop?category=${localizedSlides[currentSlide].category}`}
                className="inline-flex bg-orange-600 hover:bg-orange-700 text-white font-bold px-4 py-2 rounded-xl text-[10px] items-center gap-1 shadow-md shadow-orange-600/10 cursor-pointer"
              >
                <span>{localizedSlides[currentSlide].ctaText}</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>

            <button
              onClick={handlePrevSlide}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-5.5 w-5.5 rounded-full bg-orange-600 hover:bg-orange-700 flex items-center justify-center text-white shadow-sm border-0 cursor-pointer transition-colors z-20"
            >
              <ChevronLeft className="size-3" />
            </button>
            <button
              onClick={handleNextSlide}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-5.5 w-5.5 rounded-full bg-orange-600 hover:bg-orange-700 flex items-center justify-center text-white shadow-sm border-0 cursor-pointer transition-colors z-20"
            >
              <ChevronRight className="size-3" />
            </button>

            <div className="absolute bottom-3 right-4 flex gap-1.5 z-20">
              {localizedSlides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${currentSlide === idx ? "w-4 bg-orange-600" : "w-1.5 bg-slate-300 hover:bg-slate-400"}`}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 h-auto md:h-[140px] py-1 md:py-0">
            <div className="bg-linear-to-br from-amber-50 to-orange-50 border border-orange-100 rounded-2xl p-3 flex flex-col justify-between text-left">
              <div className="space-y-1">
                <span className="text-[9px] font-black text-orange-600 bg-orange-100 px-2 py-0.5 rounded border border-orange-200/50 w-max block">{t("goodGoods")}</span>
                <h4 className="font-extrabold text-[11px] text-slate-800">Authentic Tech Items</h4>
                <p className="text-[10px] text-slate-400 line-clamp-1 leading-normal">Premium items rated over 4.8 stars in databases.</p>
              </div>
              <Link
                href="/shop?category=Electronics"
                className="text-[10px] font-bold text-orange-700 flex items-center gap-0.5 hover:underline"
              >
                <span>{t("buyItems")}</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>

            <div className="bg-linear-to-br from-orange-50/40 to-rose-50 border border-rose-100 rounded-2xl p-3 flex flex-col justify-between text-left">
              <div className="space-y-1">
                <span className="text-[9px] font-black text-rose-600 bg-rose-100 px-2 py-0.5 rounded border border-rose-200/50 w-max block">{t("dailyDeals")}</span>
                <h4 className="font-extrabold text-[11px] text-slate-800">Autumn Markdown Deals</h4>
                <p className="text-[10px] text-slate-400 line-clamp-1 leading-normal">Simulated discount rates up to 15% applied instantly.</p>
              </div>
              <Link
                href="/shop"
                className="text-[10px] font-bold text-rose-700 flex items-center gap-0.5 hover:underline"
              >
                <span>{t("buyItems")}</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs flex flex-col justify-around text-left h-auto lg:h-[380px] divide-y divide-slate-100 py-6 lg:p-5">
          <div className="text-center pb-4 space-y-2">
            <div className="h-12 w-12 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 mx-auto text-lg font-black shadow-3xs">
              {currentUser ? currentUser.first_name[0] : <User className="size-5 text-orange-500" />}
            </div>
            <div>
              <p className="text-xs text-slate-400">Hi, {t("welcome")}</p>
              <h3 className="font-extrabold text-sm text-slate-800 mt-0.5">
                {currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : t("memberProfile")}
              </h3>
            </div>

            {!currentUser ? (
              <div className="pt-2">
                <Link
                  href="/login"
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold py-2.5 rounded-xl transition-all cursor-pointer shadow-md shadow-orange-600/10 block text-center"
                >
                  {locale === "en" ? "Sign In / Register" : "Đăng nhập / Đăng ký"}
                </Link>
              </div>
            ) : (
              <div className="flex gap-2 justify-center pt-1.5">
                <Link
                  href="/account"
                  className="bg-slate-900 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  {t("myAccount")}
                </Link>
                <button
                  onClick={logout}
                  className="border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-655 text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  {t("signOut")}
                </button>
              </div>
            )}
          </div>

          <div className="py-3 text-center">
            <div className="grid grid-cols-3 gap-1 text-xs font-bold text-slate-500">
              <Link href="/orders" className="hover:text-orange-600 transition-colors flex flex-col items-center gap-1.5">
                <ShoppingCart className="size-5 text-orange-500" />
                <span>{t("Cart")}</span>
              </Link>
              <Link href="/account" className="hover:text-orange-600 transition-colors flex flex-col items-center gap-1.5">
                <Heart className="size-5 text-orange-500" />
                <span>{t("Favorites")}</span>
              </Link>
              <Link href="/account" className="hover:text-orange-600 transition-colors flex flex-col items-center gap-1.5">
                <Clock className="size-5 text-orange-500" />
                <span>{t("RecentViewed")}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
