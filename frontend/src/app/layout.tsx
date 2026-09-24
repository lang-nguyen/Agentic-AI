import type { Metadata } from "next";
import "./globals.css";
import { Plus_Jakarta_Sans } from "next/font/google";
import React from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { AppProviders } from "@/providers/AppProviders";

const mainFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  preload: true,
  display: "swap",
});

export const metadata: Metadata = {
  title: "Laki Shop | AI-Powered E-Commerce",
  description: "Experience premium personalized shopping powered by LangGraph AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${mainFont.className} bg-[#fbfbfb] text-slate-900`}>
        <NuqsAdapter>
          <AppProviders>{children}</AppProviders>
        </NuqsAdapter>
      </body>
    </html>
  );
}
