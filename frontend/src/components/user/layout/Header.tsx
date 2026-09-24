"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/useAuth";
import { useCart } from "@/features/cart/useCart";
import { useLocale } from "@/contexts/locale.context";
import { 
  ShoppingBag, 
  User, 
  Check, 
  LogOut, 
  ClipboardList,
  Sparkles
} from "lucide-react";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, login, logout } = useAuth();
  const { getCartTotalItems } = useCart();
  const { locale, setLocale, t } = useLocale();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isSticky, setIsSticky] = useState(false);
  const [showAIHint, setShowAIHint] = useState(false);

  const totalCartItems = getCartTotalItems();

  const handleUserSelect = (userKey: string) => {
    login(userKey);
    setShowUserDropdown(false);
  };

  const handleSignOut = () => {
    logout();
    setShowUserDropdown(false);
    router.push("/");
  };

  // Scroll detection to make header float only when scrolling down on homepage
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY >= 160) {
        setIsSticky(true);
      } else {
        setIsSticky(false);
      }
    };

    handleScroll(); // initial check
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Show tooltip hint when navigation bar becomes sticky / visible
  useEffect(() => {
    if (isSticky) {
      setShowAIHint(true);
      const timer = setTimeout(() => {
        setShowAIHint(false);
      }, 6000);
      return () => clearTimeout(timer);
    } else {
      setShowAIHint(false);
    }
  }, [isSticky]);

  // On homepage, hide header at the top, only show when scrolling down. 
  // On other catalog pages, show header normally at all times.
  const shouldRenderHeader = pathname !== "/" || isSticky;

  if (!shouldRenderHeader) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-3xs animate-in slide-in-from-top duration-300">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-9 w-9 rounded-lg bg-orange-600 flex items-center justify-center text-white font-black text-sm shadow-md group-hover:scale-105 transition-transform duration-200">
            LK
          </div>
          <span className="font-black text-base tracking-tight text-orange-600 font-display group-hover:opacity-95 transition-opacity">
            Laki Shop
          </span>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-8 text-xs uppercase tracking-wider font-bold text-slate-500">
          <Link 
            href="/" 
            className={`hover:text-orange-600 transition-colors border-b-2 py-5 ${
              pathname === "/" 
                ? "text-orange-600 border-orange-600" 
                : "border-transparent"
            }`}
          >
            {t("home")}
          </Link>
          <Link 
            href="/shop" 
            className={`hover:text-orange-600 transition-colors border-b-2 py-5 ${
              pathname.startsWith("/shop") 
                ? "text-orange-600 border-orange-600" 
                : "border-transparent"
            }`}
          >
            {t("shopCatalog")}
          </Link>
        </nav>

        {/* Action Panel */}
        <div className="flex items-center gap-3 relative">
          {/* Language Toggle */}
          <div className="flex items-center gap-1 border border-slate-200 rounded-full p-1 bg-slate-50 text-[10px] font-bold select-none mr-1">
            <button 
              onClick={() => setLocale("en")}
              className={`px-2 py-0.5 rounded-full transition-colors cursor-pointer ${locale === "en" ? "bg-orange-600 text-white" : "text-slate-500 hover:text-slate-700"}`}
            >
              EN
            </button>
            <button 
              onClick={() => setLocale("vi")}
              className={`px-2 py-0.5 rounded-full transition-colors cursor-pointer ${locale === "vi" ? "bg-orange-600 text-white" : "text-slate-500 hover:text-slate-700"}`}
            >
              VI
            </button>
          </div>

          {/* Cart Icon */}
          <button className="relative p-2 text-slate-700 hover:text-slate-900 transition-colors cursor-pointer mr-1.5 hover:scale-105 active:scale-95 duration-150">
            <ShoppingBag className="size-5" />
            {totalCartItems > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-orange-600 text-white text-[9px] font-extrabold h-4.5 w-4.5 rounded-full flex items-center justify-center animate-in scale-in duration-200 border-2 border-white">
                {totalCartItems}
              </span>
            )}
          </button>

          {/* User Signin Selector Dropdown with attached AI Mascot Bookmark */}
          <div className="relative group/user-container flex flex-col items-center">
            <button
              onClick={() => {
                if (currentUser) {
                  setShowUserDropdown(!showUserDropdown);
                } else {
                  router.push("/login");
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-xs font-bold rounded-full transition-all cursor-pointer bg-white shadow-3xs relative z-10"
            >
              <User className="size-3.5 text-slate-655" />
              <span className="max-w-[80px] truncate">
                {currentUser ? `${currentUser.first_name}` : t("pleaseLogIn")}
              </span>
            </button>

            {/* AI Mascot Bookmark (tucks behind and hangs down below User button) */}
            <button
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                window.dispatchEvent(new CustomEvent("open-store-chat", {
                  detail: {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                  }
                }));
              }}
              title={locale === "en" ? "AI Shopping Assistant" : "Trợ lý mua sắm AI"}
              className="absolute left-1/2 -translate-x-1/2 top-full -mt-0.5 z-0 flex flex-col items-center cursor-pointer group/bookmark active:scale-95 transition-all select-none focus:outline-none hover:scale-105 duration-150"
            >
              {showAIHint && (
                <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 bg-linear-to-r from-orange-600 to-orange-500 text-white font-extrabold text-[10px] px-2.5 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5 whitespace-nowrap z-50 border border-orange-400/25 select-none animate-in fade-in slide-in-from-right-3 duration-300">
                  <span className="inline-block animate-bounce-horizontal text-xs">👉</span>
                  <span>{locale === "en" ? "Your AI is here!" : "AI của bạn ở đây!"}</span>
                  
                  {/* Arrow pointing right */}
                  <div className="absolute top-1/2 -translate-y-1/2 left-full w-0 h-0 border-y-[5px] border-y-transparent border-l-[5px] border-l-orange-500" />
                </div>
              )}
              {/* Rounded Bookmarked ribbon/tag (Made larger w-[42px] h-[52px] and hangs down further with -mt-0.5) */}
              <div className="bg-linear-to-b from-orange-500 to-orange-600 text-white w-[42px] h-[52px] rounded-b-xl shadow-md flex flex-col items-center justify-between pb-1.5 pt-2 border-t-0 hover:from-orange-600 hover:to-orange-700 transition-colors relative">
                
                {/* Mascot circle container wrapper (allows unclipped absolute child) */}
                <div className="relative shrink-0 mt-0.5">
                  {/* Mascot circle (with overflow-hidden) */}
                  <div className="h-7 w-7 rounded-full bg-white flex items-center justify-center overflow-hidden border border-orange-100 shadow-2xs">
                    <img 
                      src="/taobao_mascot.png" 
                      alt="AI" 
                      className="h-5.5 w-5.5 object-contain mt-0.5"
                    />
                  </div>
                  {/* Pulsing online green dot (outside overflow-hidden to prevent clipping) */}
                  <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2 z-10 select-none">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 border border-white"></span>
                  </span>
                </div>
                
                {/* AI Label (enlarged text-[8px]) */}
                <span className="text-[8px] font-black uppercase tracking-wider text-orange-50 select-none leading-none">
                  AI
                </span>
              </div>
            </button>

            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50 animate-in fade-in-50 slide-in-from-top-2 duration-200 text-left">
                <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b mb-1">
                  Select User Session
                </div>
                <button
                  onClick={() => handleUserSelect("noah_brown_6181")}
                  className="flex items-center justify-between w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                >
                  <div>
                    <p className="font-semibold">Noah Brown</p>
                    <p className="text-[10px] text-slate-400">noah.brown7922@...</p>
                  </div>
                  {currentUser?.id === "noah_brown_6181" && <Check className="size-3.5 text-orange-600" />}
                </button>
                <button
                  onClick={() => handleUserSelect("ivan_santos_6635")}
                  className="flex items-center justify-between w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-lg transition-colors transition-all cursor-pointer"
                >
                  <div>
                    <p className="font-semibold">Ivan Santos</p>
                    <p className="text-[10px] text-slate-400">ivan.santos3158@...</p>
                  </div>
                  {currentUser?.id === "ivan_santos_6635" && <Check className="size-3.5 text-orange-600" />}
                </button>
                {currentUser && (
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer mt-1 border-t"
                  >
                    <LogOut className="size-3.5" />
                    <span className="font-semibold">{t("signOut")}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
