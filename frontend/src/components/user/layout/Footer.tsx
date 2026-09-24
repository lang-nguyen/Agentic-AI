"use client";

import React from "react";

export function Footer() {
  return (
    <footer className="bg-white text-slate-500 border-t border-slate-250 py-12 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-left">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-slate-900 text-sm">Laki Shop</span>
          <span>| Powered by LangGraph & Gemini</span>
        </div>
        <p>© 2026 Laki Shop. All rights reserved.</p>
      </div>
    </footer>
  );
}
