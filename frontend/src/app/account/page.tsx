"use client";

import React, { Suspense } from "react";
import AccountDashboard from "@/components/user/account/AccountDashboard";

export default function AccountPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    }>
      <AccountDashboard />
    </Suspense>
  );
}
