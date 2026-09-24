"use client";

import { Thread } from "@/components/admin";
import { StreamProvider } from "@/providers/Stream";
import { ThreadProvider } from "@/providers/Thread";
import { ArtifactProvider } from "@/components/admin/artifact";
import { Toaster } from "@/components/common/ui/sonner";
import React from "react";

export default function AdminDeveloperThreadPage(): React.ReactNode {
  return (
    <React.Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500 font-semibold text-sm">Loading Developer Session...</div>}>
      <Toaster />
      <ThreadProvider>
        <StreamProvider>
          <ArtifactProvider>
            <div className="admin-theme min-h-screen bg-[#f8fafc]">
              <Thread mode="developer" />
            </div>
          </ArtifactProvider>
        </StreamProvider>
      </ThreadProvider>
    </React.Suspense>
  );
}
