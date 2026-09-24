"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useQueryState } from "nuqs";
import { createClient } from "@/providers/client";
import { getApiKey } from "@/lib/api-key";
import { Button } from "@/components/common/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/common/ui/card";
import {
  RefreshCw,
  User,
  MessageSquare,
  Clock,
  ArrowRight,
  Eye,
  Users,
  Activity,
  AlertTriangle,
  Search,
  CheckCircle2,
  Inbox
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { type Client } from "@langchain/langgraph-sdk";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_CONFIG } from "@/config/api";
import { colors } from "@/theme/admin";
import { MOCK_USERS } from "@/data/mockData";
import { translations, Locale } from "@/locales/translations";

interface ThreadStateMetadata {
  lastMessage: string;
  assignee?: string | null;
  staff_thread_id?: string | null;
}

interface CustomerThreadDetail {
  thread_id: string;
  is_guest: boolean;
  assignee: string;
}

interface CustomerThreadItem {
  namespace: string[];
  key: string;
  value: {
    threads: CustomerThreadDetail[];
  };
  created_at: string;
  updated_at: string;
}

interface NotificationEvent {
  id: string;
  thread_id: string;
  created_at: string;
  read: boolean;
  type?: "CREATED" | "TRANSFER" | "MESSAGE";
  staff_id?: string;
}

// Safe metadata fetcher
const fetchThreadMetadata = async (client: Client, threadId: string): Promise<ThreadStateMetadata> => {
  try {
    const state = await client.threads.getState(threadId);
    const messages = (state.values as any)?.messages || [];
    let lastMsg = "No messages";
    if (messages.length > 0) {
      const last = messages[messages.length - 1];
      lastMsg = typeof last.content === "string" ? last.content : JSON.stringify(last.content);
    }
    const extra = (state.values as any)?.extra || {};
    return {
      lastMessage: lastMsg,
      assignee: extra.assignee || null,
      staff_thread_id: extra.staff_thread_id || null
    };
  } catch (err) {
    console.error(`Error fetching state for thread ${threadId}:`, err);
    return {
      lastMessage: "Failed to load message",
      assignee: null,
      staff_thread_id: null
    };
  }
};

function SalesDashboardContent(): React.ReactNode {
  const router = useRouter();

  const [locale, setLocale] = useState<Locale>("vi");
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("store:locale") as Locale;
      if (stored) setLocale(stored);
    }
  }, []);

  const t = useCallback((key: keyof typeof translations.vi): string => {
    const dict = translations[locale] || translations.vi;
    return dict[key] || translations.vi[key] || String(key);
  }, [locale]);

  // Connection settings
  const envApiUrl = process.env.NEXT_PUBLIC_API_URL || API_CONFIG.langgraphBaseUrl;
  const envAssistantId = process.env.NEXT_PUBLIC_ASSISTANT_ID || "react_agent";
  const envAuthScheme = process.env.NEXT_PUBLIC_AUTH_SCHEME || "";

  const [apiUrl] = useQueryState("apiUrl", { defaultValue: envApiUrl });
  const [assistantId] = useQueryState("assistantId", { defaultValue: envAssistantId });
  const [authScheme] = useQueryState("authScheme", { defaultValue: envAuthScheme });

  const [customerThreads, setCustomerThreads] = useState<CustomerThreadItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [threadMetadata, setThreadMetadata] = useState<Record<string, ThreadStateMetadata>>({});
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed">("all");

  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [sseCreatedAssignees, setSseCreatedAssignees] = useState<Record<string, string>>({});

  // Helper to construct link to the 3-column observer
  const makeSaleLink = useCallback((tid: string) => {
    const params = new URLSearchParams();
    params.set("threadId", tid);
    if (apiUrl) params.set("apiUrl", apiUrl);
    if (assistantId) params.set("assistantId", assistantId);
    if (authScheme) params.set("authScheme", authScheme);
    return `/admin/sale/thread?${params.toString()}`;
  }, [apiUrl, assistantId, authScheme]);

  // Fetch only customer-relevant support threads
  const fetchSalesData = useCallback(async () => {
    if (!apiUrl) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const client = createClient(
        apiUrl,
        getApiKey() ?? undefined,
        authScheme || undefined
      );

      // Fetch customer, guest threads and server-level threads in parallel
      const [customerRes, guestRes, serverThreads] = await Promise.all([
        client.store.searchItems(["customer_threads"], { limit: 100 }),
        client.store.searchItems(["guest_threads"], { limit: 100 }),
        client.threads.search({ limit: 100 })
      ]);

      const members = (customerRes.items as unknown as CustomerThreadItem[]) || [];
      const guests = (guestRes.items as unknown as CustomerThreadItem[]) || [];

      let customers = [...members, ...guests];

      // Collect all thread IDs currently in the customers list
      const existingThreadIds = new Set<string>();
      customers.forEach(item => {
        item.value.threads?.forEach(t => {
          if (t.thread_id) existingThreadIds.add(t.thread_id);
        });
        existingThreadIds.add(item.key);
      });

      // Merge newly created threads from server not yet stored in customer/guest namespaces
      if (Array.isArray(serverThreads)) {
        serverThreads.forEach((thread: any) => {
          if (!existingThreadIds.has(thread.thread_id)) {
            customers.push({
              namespace: ["guest_threads"],
              key: thread.thread_id,
              value: {
                threads: [
                  {
                    thread_id: thread.thread_id,
                    is_guest: true,
                    assignee: "agent"
                  }
                ]
              },
              created_at: thread.created_at || new Date().toISOString(),
              updated_at: thread.updated_at || new Date().toISOString()
            });
            existingThreadIds.add(thread.thread_id);
          }
        });
      }

      setCustomerThreads(customers);

      // Extract thread IDs to fetch metadata
      const threadIds: string[] = [];
      customers.forEach((item) => {
        item.value.threads?.forEach((t) => {
          const tid = t.thread_id || item.key;
          if (tid) threadIds.push(tid);
        });
        if (item.value.threads?.length === 0 || !item.value.threads) {
          threadIds.push(item.key);
        }
      });

      const uniqueThreadIds = Array.from(new Set(threadIds));

      const metadataMap: Record<string, ThreadStateMetadata> = {};
      await Promise.all(
        uniqueThreadIds.map(async (tid) => {
          metadataMap[tid] = await fetchThreadMetadata(client, tid);
        })
      );

      setThreadMetadata(metadataMap);
    } catch (err: any) {
      console.error("[SalesDashboard] Error fetching store items:", err);
      setErrorMessage(err.message || "Failed to fetch thread data from the store.");
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, authScheme]);

  // Helper to fetch metadata and update for a single thread on SSE events
  const fetchAndUpdateThread = useCallback(async (threadId: string) => {
    if (!apiUrl) return;
    try {
      const client = createClient(
        apiUrl,
        getApiKey() ?? undefined,
        authScheme || undefined
      );
      const meta = await fetchThreadMetadata(client, threadId);
      setThreadMetadata(prev => ({
        ...prev,
        [threadId]: meta
      }));
    } catch (err) {
      console.error(`[SSE] Error fetching metadata for thread ${threadId}:`, err);
    }
  }, [apiUrl, authScheme]);

  // Connect to SSE for real-time thread updates (same as admin dashboard)
  useEffect(() => {
    if (!apiUrl) return;

    const url = `${apiUrl}/api/events/admin`;
    console.log("[Sales SSE] Connecting to:", url);
    const eventSource = new EventSource(url);

    const handleEventData = (dataStr: string) => {
      try {
        const payload = JSON.parse(dataStr);
        console.log("[Sales SSE] New thread event received:", payload);

        toast(t("newSupportRequest"), {
          description: `${t("sessionCode")}: ${payload.thread_id.substring(0, 8)}...`,
          action: {
            label: "Xử lý ngay",
            onClick: () => {
              router.push(makeSaleLink(payload.thread_id));
            }
          },
          duration: 10000,
        });

        const newNotification: NotificationEvent = {
          id: `${payload.thread_id}-${Date.now()}`,
          thread_id: payload.thread_id,
          created_at: payload.created_at || new Date().toISOString(),
          read: false,
          type: "CREATED"
        };
        setNotifications(prev => [newNotification, ...prev]);
        setSseCreatedAssignees(prev => ({
          ...prev,
          [payload.thread_id]: "agent"
        }));

        // Refresh threads list
        fetchSalesData();
      } catch (err) {
        console.error("[Sales SSE] Error parsing event data:", err);
      }
    };

    eventSource.onmessage = (event) => {
      handleEventData(event.data);
    };

    eventSource.addEventListener("THREAD_CREATED", (event: any) => {
      handleEventData(event.data);
    });

    eventSource.addEventListener("NEW_MESSAGE", (event: any) => {
      try {
        const payload = JSON.parse(event.data);
        console.log("[Sales SSE] NEW_MESSAGE received:", payload);
        const threadId = payload.thread_id;

        if (threadId) {
          toast(t("newCustomerMessage"), {
            description: `${t("sessionCode")}: ${threadId.substring(0, 8)}...`,
            action: {
              label: t("viewChat"),
              onClick: () => {
                router.push(makeSaleLink(threadId));
              }
            },
            duration: 8000,
          });

          const newNotification: NotificationEvent = {
            id: `msg-${threadId}-${Date.now()}`,
            thread_id: threadId,
            created_at: new Date().toISOString(),
            read: false,
            type: "MESSAGE",
          };
          setNotifications(prev => [newNotification, ...prev]);

          fetchAndUpdateThread(threadId);
          fetchSalesData();
        }
      } catch (err) {
        console.error("[Sales SSE] Error parsing NEW_MESSAGE:", err);
      }
    });

    eventSource.addEventListener("TRANSFER_TO_HUMAN", (event: any) => {
      try {
        const payload = JSON.parse(event.data);
        console.log("[Sales SSE] TRANSFER_TO_HUMAN received:", payload);

        toast(t("transferToHumanRequest"), {
          description: t("transferDesc"),
          action: {
            label: t("handleRequest"),
            onClick: () => {
              router.push(makeSaleLink(payload.customer_thread_id));
            }
          },
          duration: 10000,
        });

        const newNotification: NotificationEvent = {
          id: `transfer-${payload.customer_thread_id}-${Date.now()}`,
          thread_id: payload.customer_thread_id,
          created_at: new Date().toISOString(),
          read: false,
          type: "TRANSFER",
          staff_id: payload.staff_id,
        };
        setNotifications(prev => [newNotification, ...prev]);

        fetchAndUpdateThread(payload.customer_thread_id);
        fetchSalesData();
      } catch (err) {
        console.error("[Sales SSE] Error parsing TRANSFER_TO_HUMAN:", err);
      }
    });

    return () => {
      console.log("[Sales SSE] Closing connection");
      eventSource.close();
    };
  }, [apiUrl, router, makeSaleLink, fetchSalesData, fetchAndUpdateThread]);

  useEffect(() => {
    fetchSalesData();
  }, [fetchSalesData]);

  // Helper to format date safely
  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch (e) {
      return dateStr;
    }
  };

  // Flattened customer threads list
  const flattenedThreads = useMemo(() => {
    const list: Array<{
      threadId: string;
      customerId: string;
      isGuest: boolean;
      updatedAt: string;
      createdAt: string;
    }> = [];

    customerThreads.forEach((item) => {
      const customerId = item.key;
      const isGuest = item.namespace.includes("guest_threads");

      if (item.value.threads && item.value.threads.length > 0) {
        item.value.threads.forEach((t) => {
          list.push({
            threadId: t.thread_id || customerId,
            customerId,
            isGuest,
            updatedAt: item.updated_at,
            createdAt: item.created_at
          });
        });
      } else {
        list.push({
          threadId: customerId,
          customerId,
          isGuest,
          updatedAt: item.updated_at,
          createdAt: item.created_at
        });
      }
    });

    // Sort by updated_at descending
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [customerThreads]);

  // Filtered threads list based on search and status
  const filteredThreads = useMemo(() => {
    return flattenedThreads.filter((t) => {
      const meta = threadMetadata[t.threadId];
      const lastMsg = (meta?.lastMessage || "").toLowerCase();

      // Resolve mock profile matching customerId
      const user = MOCK_USERS[t.customerId] || { first_name: "Nguyễn", last_name: "Văn A" };
      const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();

      const matchesSearch =
        t.threadId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fullName.includes(searchQuery.toLowerCase()) ||
        lastMsg.includes(searchQuery.toLowerCase());

      // Filter status
      const isPendingExchange = lastMsg.includes("đổi") || lastMsg.includes("trả") || lastMsg.includes("size") || lastMsg.includes("nhỏ");
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "pending" && isPendingExchange) ||
        (statusFilter === "completed" && !isPendingExchange && lastMsg.length > 0);

      return matchesSearch && matchesStatus;
    });
  }, [flattenedThreads, threadMetadata, searchQuery, statusFilter]);

  // Mock dashboard summary counts
  const summaryCounts = useMemo(() => {
    const total = flattenedThreads.length;
    const pending = flattenedThreads.filter(t => {
      const msg = (threadMetadata[t.threadId]?.lastMessage || "").toLowerCase();
      return msg.includes("đổi") || msg.includes("trả") || msg.includes("size") || msg.includes("nhỏ");
    }).length;
    return {
      total,
      pending,
      completed: Math.max(0, total - pending)
    };
  }, [flattenedThreads, threadMetadata]);

  return (
    <div className={`min-h-screen ${colors.background} p-6 md:p-8 font-sans admin-theme`}>
      <div className="mx-auto max-w-7xl flex flex-col gap-6">

        {/* Top Header Panel */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-100 p-6 rounded-2xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600">
              <Users className="size-6" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 text-left">
                {t("salesSupportDashboard")}
              </h1>
              <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Clock className="size-3.5 text-slate-400" />
                {t("salesDashboardDesc")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end md:self-auto">
            <Button
              variant="outline"
              size="icon"
              onClick={fetchSalesData}
              disabled={isLoading}
              className="rounded-xl border-slate-200 hover:bg-slate-50 h-10 w-10 flex items-center justify-center transition-all"
              title="Refresh Data"
            >
              <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-white border-slate-100 shadow-3xs rounded-2xl text-left">
            <CardHeader className="pb-2">
              <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("totalSupportSessions")}</CardDescription>
              <CardTitle className="text-3xl font-black text-slate-800 flex items-center gap-2 mt-1">
                <Inbox className="size-6 text-indigo-500" />
                {summaryCounts.total}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="bg-white border-slate-100 shadow-3xs rounded-2xl text-left">
            <CardHeader className="pb-2">
              <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("pendingExchange")}</CardDescription>
              <CardTitle className="text-3xl font-black text-amber-600 flex items-center gap-2 mt-1">
                <Activity className="size-6 text-amber-500 animate-pulse" />
                {summaryCounts.pending}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="bg-white border-slate-100 shadow-3xs rounded-2xl text-left">
            <CardHeader className="pb-2">
              <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("completedExchange")}</CardDescription>
              <CardTitle className="text-3xl font-black text-emerald-600 flex items-center gap-2 mt-1">
                <CheckCircle2 className="size-6 text-emerald-500" />
                {summaryCounts.completed}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Error Alert Box */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-start gap-3 text-rose-700 animate-in fade-in duration-200">
            <AlertTriangle className="size-5 mt-0.5 flex-shrink-0" />
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-sm">Lỗi đồng bộ dữ liệu</span>
              <span className="text-xs font-normal opacity-90">{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Filter Bar & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Status filter tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl self-start">
            <button
              onClick={() => setStatusFilter("all")}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${statusFilter === "all"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
                }`}
            >
              {t("all")}
            </button>
            <button
              onClick={() => setStatusFilter("pending")}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${statusFilter === "pending"
                  ? "bg-white text-amber-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
                }`}
            >
              {t("needAction")}
            </button>
            <button
              onClick={() => setStatusFilter("completed")}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${statusFilter === "completed"
                  ? "bg-white text-emerald-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
                }`}
            >
              {t("completed")}
            </button>
          </div>

          {/* Search box */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-3 size-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchSessionPlaceholder")}
              className="w-full bg-white border border-slate-200 pl-10 pr-4 py-2.5 text-xs rounded-xl outline-none focus:border-indigo-500 transition-all font-semibold text-slate-800 placeholder-slate-400"
            />
          </div>
        </div>

        {/* Main threads table */}
        <Card className="bg-white border-slate-100 shadow-3xs rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            {isLoading && filteredThreads.length === 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="p-4 pl-6 w-1/5"><div className="h-3.5 bg-slate-100 rounded-md w-16 animate-pulse" /></th>
                      <th className="p-4 w-1/4"><div className="h-3.5 bg-slate-100 rounded-md w-24 animate-pulse" /></th>
                      <th className="p-4 w-1/3"><div className="h-3.5 bg-slate-100 rounded-md w-32 animate-pulse" /></th>
                      <th className="p-4 w-1/6"><div className="h-3.5 bg-slate-100 rounded-md w-16 animate-pulse" /></th>
                      <th className="p-4 pr-6 text-right w-12"><div className="h-3.5 bg-slate-100 rounded-md w-12 ml-auto animate-pulse" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5].map((idx) => (
                      <tr key={idx} className="border-b border-slate-50 last:border-b-0">
                        {/* Session ID */}
                        <td className="p-4 pl-6">
                          <div className="h-3 bg-slate-100 rounded-md w-20 animate-pulse" />
                        </td>
                        {/* Customer */}
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-slate-100 animate-pulse shrink-0" />
                            <div className="h-3 bg-slate-100 rounded-md w-16 animate-pulse" />
                          </div>
                        </td>
                        {/* Request */}
                        <td className="p-4">
                          <div className="flex flex-col gap-1.5">
                            <div className="h-3 bg-slate-100 rounded-md w-48 animate-pulse" />
                            <div className="h-2.5 bg-slate-50 rounded-md w-16 animate-pulse" />
                          </div>
                        </td>
                        {/* Time */}
                        <td className="p-4">
                          <div className="h-3 bg-slate-100 rounded-md w-14 animate-pulse" />
                        </td>
                        {/* Action button */}
                        <td className="p-4 pr-6 text-right">
                          <div className="h-7 bg-slate-150 rounded-lg w-24 ml-auto animate-pulse" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="py-24 text-center text-xs text-slate-400 font-medium flex flex-col items-center justify-center gap-2">
                <Inbox className="size-8 text-slate-200" />
                Không tìm thấy phiên hỗ trợ nào phù hợp
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="text-[10px] font-bold text-slate-400 uppercase p-4 pl-6 w-1/5">{t("sessionCode")}</th>
                      <th className="text-[10px] font-bold text-slate-400 uppercase p-4 w-1/4">{t("customer")}</th>
                      <th className="text-[10px] font-bold text-slate-400 uppercase p-4 w-1/3">{t("latestRequest")}</th>
                      <th className="text-[10px] font-bold text-slate-400 uppercase p-4 w-1/6">{t("time")}</th>
                      <th className="text-[10px] font-bold text-slate-400 uppercase p-4 pr-6 text-right">{t("action")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredThreads.map((threadItem) => {
                      const meta = threadMetadata[threadItem.threadId];
                      const lastMsg = meta?.lastMessage || "Chưa có tin nhắn...";
                      const isPendingExchange = lastMsg.toLowerCase().includes("đổi") || lastMsg.toLowerCase().includes("trả") || lastMsg.toLowerCase().includes("size") || lastMsg.toLowerCase().includes("nhỏ");

                      // Resolve mock profile matching customerId
                      const user = MOCK_USERS[threadItem.customerId] || { first_name: "Nguyễn", last_name: "Văn A" };

                      return (
                        <tr key={threadItem.threadId} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 transition-colors">
                          {/* Thread ID */}
                          <td className="p-4 pl-6">
                            <span className="text-xs font-mono font-bold text-slate-700 select-all">
                              {threadItem.threadId.substring(0, 8)}...
                            </span>
                          </td>

                          {/* Customer */}
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">
                                G
                              </div>
                              <div className="flex flex-col text-left">
                                <span className="font-bold text-xs text-slate-800">
                                  Guest
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Last Message */}
                          <td className="p-4 max-w-xs">
                            <div className="flex flex-col gap-1 text-left">
                              <p className="text-xs text-slate-600 font-medium truncate" title={lastMsg}>
                                {lastMsg}
                              </p>
                              {isPendingExchange && (
                                <span className="self-start bg-amber-50 text-amber-600 border border-amber-100 text-[8.5px] font-bold px-2 py-0.2 rounded-full uppercase tracking-wider">
                                  {t("exchangeRequest")}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Time */}
                          <td className="p-4 text-xs font-medium text-slate-400">
                            {formatTime(threadItem.updatedAt)}
                          </td>

                          {/* Action Button */}
                          <td className="p-4 pr-6 text-right">
                            <Button
                              size="sm"
                              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all py-1.5 shadow-xs inline-flex hover:scale-102"
                              asChild
                            >
                              <Link href={makeSaleLink(threadItem.threadId)}>
                                <Eye className="size-3.5" />
                                {t("handleRequest")}
                                <ArrowRight className="size-3" />
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

export default function SalesDashboard() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-xs text-slate-500 font-bold">Đang tải dashboard...</div>}>
      <SalesDashboardContent />
    </React.Suspense>
  );
}
