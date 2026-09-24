"use client";

import React from "react";
import { StreamProvider } from "@/providers/Stream";
import { ThreadProvider } from "@/providers/Thread";
import { ArtifactProvider } from "@/components/admin/artifact";
import { Toaster } from "@/components/common/ui/sonner";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { ChatWidget } from "../widgets/ChatWidget";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#fbfbfb] text-slate-500 font-semibold text-sm">Loading Client Environment...</div>}>
      <Toaster />
      <ThreadProvider>
        <StreamProvider syncToUrl={false}>
          <ArtifactProvider>
            <div className="min-h-screen bg-[#fbfbfb] text-slate-900 font-sans flex flex-col">
              <Header />
              <main className="flex-grow">{children}</main>
              <Footer />
              <ChatWidget defaultAssistantId="guardian_graph" />
            </div>
          </ArtifactProvider>
        </StreamProvider>
      </ThreadProvider>
    </React.Suspense>
  );
}
