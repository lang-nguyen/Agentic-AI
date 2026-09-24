"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  Terminal, 
  MessageSquare, 
  ChevronLeft, 
  ChevronRight, 
  Store,
  Sparkles,
  ClipboardList,
  Sliders,
  ChevronDown,
  Package,
  Bot
} from "lucide-react";
import { translations, Locale } from "@/locales/translations";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [locale, setLocale] = useState<Locale>("vi");
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedCollapsed = localStorage.getItem("admin:sidebar-collapsed");
      if (storedCollapsed === "true") {
        setIsCollapsed(true);
      }
      
      const storedLocale = localStorage.getItem("store:locale") as Locale;
      if (storedLocale) {
        setLocale(storedLocale);
      }
    }
  }, []);

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (typeof window !== "undefined") {
      localStorage.setItem("admin:sidebar-collapsed", String(newState));
    }
  };

  const t = useCallback((key: keyof typeof translations.vi): string => {
    const dict = translations[locale] || translations.vi;
    return dict[key] || translations.vi[key] || String(key);
  }, [locale]);

  const menuItems = [
    {
      label: t("smartReturnSetting"),
      path: "/admin/rules",
      icon: Sliders,
    },
    {
      label: t("autonomousAgentSetting"),
      path: "/admin/agent",
      icon: Bot,
    },
    {
      label: t("orderManagement"),
      icon: ClipboardList,
      subItems: [
        {
          label: t("allOrders"),
          path: "/admin/orders",
        },
        {
          label: t("processReturn"),
          path: "/admin/orders/return",
        }
      ]
    },
    {
      label: t("productManagement"),
      path: "/admin/products",
      icon: Package,
    },
    {
      label: t("salesSupportDashboard"),
      path: "/admin/sale",
      icon: Users,
    },
    {
      label: t("devDashboard"),
      path: "/admin/dashboard",
      icon: LayoutDashboard,
    },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 font-sans admin-theme">
      {/* Collapsible Sidebar */}
      <aside 
        className={`h-screen bg-slate-900 text-slate-350 border-r border-slate-800 flex flex-col justify-between shrink-0 transition-[width] duration-300 ease-in-out will-change-[width] relative select-none z-50 ${
          isCollapsed ? "w-16" : "w-60"
        }`}
      >
        <div className="flex flex-col">
          {/* Logo Header */}
          <div className="h-14 border-b border-slate-800 flex items-center px-4 gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white flex items-center justify-center shrink-0">
              <Sparkles className="size-4" />
            </div>
            <span className={`font-black text-sm text-white tracking-wider uppercase truncate transition-all duration-300 ease-in-out origin-left ${
              isCollapsed 
                ? "w-0 opacity-0 -translate-x-4 max-w-0 pointer-events-none" 
                : "w-auto opacity-100 translate-x-0 max-w-[150px]"
            }`}>
              {t("lakiPanel")}
            </span>
          </div>

          {/* Menu Items */}
          <nav className="p-3 flex flex-col gap-1.5 mt-4">
            {menuItems.map((item) => {
              const Icon = item.icon;

              if (item.subItems) {
                const isSubActive = item.subItems.some(sub => pathname === sub.path.split("?")[0]);
                const isParentActive = isSubActive;

                return (
                  <div key={item.label} className="flex flex-col">
                    <button
                      onClick={() => {
                        if (isCollapsed) {
                          setIsCollapsed(false);
                          setIsOrdersOpen(true);
                        } else {
                          setIsOrdersOpen(prev => !prev);
                        }
                      }}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border-none bg-transparent cursor-pointer text-left group w-full ${
                        isParentActive 
                          ? "bg-indigo-600/10 text-indigo-400" 
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                      }`}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <Icon className={`size-4 shrink-0 transition-transform ${
                        isParentActive ? "scale-110 text-indigo-400" : "group-hover:scale-105"
                      }`} />
                      <span className={`transition-all duration-300 ease-in-out origin-left overflow-hidden whitespace-nowrap ${
                        isCollapsed 
                          ? "w-0 opacity-0 -translate-x-4 max-w-0 pointer-events-none" 
                          : "w-auto opacity-100 translate-x-0 max-w-[200px]"
                      }`}>
                        {item.label}
                      </span>
                      {!isCollapsed && (
                        <ChevronDown className={`size-3.5 ml-auto text-slate-500 transition-transform ${
                          isOrdersOpen ? "rotate-180" : ""
                        }`} />
                      )}
                    </button>

                    {/* Submenu list */}
                    <div className={`transition-all duration-300 overflow-hidden flex flex-col gap-1 pl-9 ${
                      isOrdersOpen && !isCollapsed ? "max-h-24 opacity-100 mt-1" : "max-h-0 opacity-0 pointer-events-none"
                    }`}>
                      {item.subItems.map((sub) => {
                        const isSubItemActive = pathname === sub.path.split("?")[0];
                        return (
                          <Link
                            key={sub.path}
                            href={sub.path}
                            className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all text-left ${
                              isSubItemActive 
                                ? "bg-slate-800 text-indigo-400 font-extrabold" 
                                : "text-slate-500 hover:text-slate-350 hover:bg-slate-800/30"
                            }`}
                          >
                            {sub.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              const isActive = pathname === item.path || pathname?.startsWith((item.path || "") + "/");
              return (
                <Link
                  key={item.path}
                  href={item.path || ""}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all group ${
                    isActive 
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" 
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className={`size-4 shrink-0 transition-transform ${
                    isActive ? "scale-110" : "group-hover:scale-105"
                  }`} />
                  <span className={`transition-all duration-300 ease-in-out origin-left overflow-hidden whitespace-nowrap ${
                    isCollapsed 
                      ? "w-0 opacity-0 -translate-x-4 max-w-0 pointer-events-none" 
                      : "w-auto opacity-100 translate-x-0 max-w-[200px]"
                  }`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-800 flex flex-col gap-1.5">
          {/* Back to shop */}
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all"
            title={isCollapsed ? t("backToShop") : undefined}
          >
            <Store className="size-4 shrink-0" />
            <span className={`transition-all duration-300 ease-in-out origin-left overflow-hidden whitespace-nowrap ${
              isCollapsed 
                ? "w-0 opacity-0 -translate-x-4 max-w-0 pointer-events-none" 
                : "w-auto opacity-100 translate-x-0 max-w-[150px]"
            }`}>
              {t("backToShop")}
            </span>
          </Link>

          {/* Toggle Button */}
          <button
            onClick={toggleSidebar}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all text-left w-full border-none cursor-pointer"
          >
            {isCollapsed ? (
              <ChevronRight className="size-4 shrink-0" />
            ) : (
              <ChevronLeft className="size-4 shrink-0" />
            )}
            <span className={`transition-all duration-300 ease-in-out origin-left overflow-hidden whitespace-nowrap ${
              isCollapsed 
                ? "w-0 opacity-0 -translate-x-4 max-w-0 pointer-events-none" 
                : "w-auto opacity-100 translate-x-0 max-w-[150px]"
            }`}>
              {t("collapse")}
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-y-auto relative">
        {children}
      </main>
    </div>
  );
}
