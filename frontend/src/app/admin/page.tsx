"use client";

import { redirect } from "next/navigation";
import { useEffect } from "react";

export default function AdminIndexPage() {
  useEffect(() => {
    redirect("/admin/dashboard");
  }, []);
  return null;
}
