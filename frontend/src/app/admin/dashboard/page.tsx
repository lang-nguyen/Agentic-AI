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
  Users, 
  MessageSquare, 
  Clock, 
  ArrowRight, 
  Eye, 
  Shield,
  Activity,
  AlertTriangle,
  Search,
  Database,
  Settings,
  Bell
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { type Client } from "@langchain/langgraph-sdk";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_CONFIG } from "@/config/api";
import { MiniThreadMonitor } from "@/components/admin/MiniThreadMonitor";
import { colors } from "@/theme/admin";

interface ThreadStateMetadata {
  lastMessage: string;
  assignee?: string | null;
  staff_thread_id?: string | null;
}

const getStaffIdForThread = (threadId: string, staffList: StaffThreadItem[]) => {
  const match = staffList.find(s => 
    s.value.threads?.some(t => t.customer_thread_id === threadId || t.thread_id === threadId)
  );
  return match ? match.key : null;
};

const getAssigneeLabel = (meta?: ThreadStateMetadata, threadId?: string, staffList?: StaffThreadItem[]) => {
  if (!meta) return "Loading...";
  const assignee = meta.assignee;
  
  if (!assignee) return "Unassign";
  
  if (assignee === "human") {
    const staffId = threadId && staffList ? getStaffIdForThread(threadId, staffList) : null;
    return staffId ? `Staff (${staffId})` : "Staff";
  }
  
  return assignee.charAt(0).toUpperCase() + assignee.slice(1);
};

const getAssigneeBadgeStyles = (assignee: string) => {
  const norm = (assignee || "").toLowerCase();
  if (norm === "staff" || norm === "hitl") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  if (norm === "agent" || norm === "new") {
    return "bg-emerald-50 text-emerald-600 border-emerald-200";
  }
  return "bg-slate-100 text-slate-600 border-slate-200";
};

const fetchThreadMetadata = async (client: Client, threadId: string): Promise<ThreadStateMetadata> => {
  try {
    const state = await client.threads.getState(threadId);
    const messages = (state.values as any)?.messages;
    let lastMsgText = "No messages yet";
    if (Array.isArray(messages) && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      let text = "";
      if (typeof lastMsg.content === "string") {
        text = lastMsg.content;
      } else if (Array.isArray(lastMsg.content)) {
        const textBlock = lastMsg.content.find((c: any) => c.type === "text");
        text = textBlock ? textBlock.text : "[Media/Files]";
      } else if (lastMsg.content && typeof lastMsg.content === "object") {
        text = (lastMsg.content as any).text || "[Media/Files]";
      }
      const role = lastMsg.type === "human" ? "User" : "Agent";
      lastMsgText = `${role}: ${text || "[Empty message]"}`;
    }

    const extra = (state.values as any)?.extra;
    const assignee = extra?.assignee || null;
    const staff_thread_id = extra?.staff_thread_id || null;

    return {
      lastMessage: lastMsgText,
      assignee,
      staff_thread_id
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

interface StaffThreadDetail {
  thread_id: string;
  customer_thread_id: string;
  customer_checkpoint_id: string;
  assignee: string;
}

interface StaffThreadItem {
  namespace: string[];
  key: string;
  value: {
    threads: StaffThreadDetail[];
  };
  created_at: string;
  updated_at: string;
}

function AdminDashboardContent(): React.ReactNode {
  const router = useRouter();

  // Connection states (fallbacks from env vars)
  const envApiUrl = process.env.NEXT_PUBLIC_API_URL || API_CONFIG.langgraphBaseUrl;
  const envAssistantId = process.env.NEXT_PUBLIC_ASSISTANT_ID || "react_agent";
  const envAuthScheme = process.env.NEXT_PUBLIC_AUTH_SCHEME || "";

  const [apiUrl, setApiUrl] = useQueryState("apiUrl", { defaultValue: envApiUrl });
  const [assistantId, setAssistantId] = useQueryState("assistantId", { defaultValue: envAssistantId });
  const [authScheme, setAuthScheme] = useQueryState("authScheme", { defaultValue: envAuthScheme });

  const [activeTab, setActiveTab] = useQueryState("tab", {
    defaultValue: "customer",
  });
  const [customerFilter, setCustomerFilter] = useQueryState("customerFilter", {
    defaultValue: "all",
  });
  const [customerThreads, setCustomerThreads] = useState<CustomerThreadItem[]>([]);
  const [staffThreads, setStaffThreads] = useState<StaffThreadItem[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [threadMetadata, setThreadMetadata] = useState<Record<string, ThreadStateMetadata>>({});
  const [showSettings, setShowSettings] = useState(false);

  interface NotificationEvent {
    id: string;
    thread_id: string;
    created_at: string;
    read: boolean;
    type?: "CREATED" | "TRANSFER" | "MESSAGE";
    staff_id?: string;
  }

  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [sseCreatedAssignees, setSseCreatedAssignees] = useState<Record<string, string>>({});

  const [selectedThreadIds, setSelectedThreadIds] = useState<string[]>([]);
  const [monitoring, setMonitoring] = useQueryState("monitoring");
  const [gridCols, setGridCols] = useState<number>(0);

  // Override assignee if thread was received via SSE
  const getThreadAssignee = useCallback((threadId: string, originalAssignee: string) => {
    if (threadId && sseCreatedAssignees[threadId]) {
      return sseCreatedAssignees[threadId];
    }
    return originalAssignee || "agent";
  }, [sseCreatedAssignees]);

  // Fetch threads function
  const fetchDashboardData = useCallback(async () => {
    if (!apiUrl) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const client = createClient(
        apiUrl,
        getApiKey() ?? undefined,
        authScheme || undefined
      );

      // Fetch customer, guest, staff threads and server-level threads in parallel
      const [customerRes, guestRes, staffRes, serverThreads] = await Promise.all([
        client.store.searchItems(["customer_threads"], { limit: 100 }),
        client.store.searchItems(["guest_threads"], { limit: 100 }),
        client.store.searchItems(["staff_threads"], { limit: 100 }),
        client.threads.search({ limit: 100 })
      ]);

      const members = (customerRes.items as unknown as CustomerThreadItem[]) || [];
      const guests = (guestRes.items as unknown as CustomerThreadItem[]) || [];
      
      let customers = [...members, ...guests];
      const staff = (staffRes.items as unknown as StaffThreadItem[]) || [];

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
            const isStaffOnly = staff.some(s => 
              s.value.threads?.some(t => t.thread_id === thread.thread_id)
            );
            if (!isStaffOnly) {
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
          }
        });
      }

      setCustomerThreads(customers);
      setStaffThreads(staff);

      // Collect all unique thread IDs to fetch their states
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
      staff.forEach((item) => {
        item.value.threads?.forEach((t) => {
          if (t.thread_id) threadIds.push(t.thread_id);
          if (t.customer_thread_id) threadIds.push(t.customer_thread_id);
        });
      });

      const uniqueThreadIds = Array.from(new Set(threadIds));

      // Fetch metadata in parallel
      const metadataMap: Record<string, ThreadStateMetadata> = {};
      await Promise.all(
        uniqueThreadIds.map(async (tid) => {
          metadataMap[tid] = await fetchThreadMetadata(client, tid);
        })
      );
      setThreadMetadata(metadataMap);
    } catch (err: any) {
      console.error("[Dashboard] Error fetching store items:", err);
      setErrorMessage(err.message || "Failed to fetch thread data from the store.");
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, authScheme]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

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

  // Helper to format date safely
  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch (e) {
      return dateStr;
    }
  };

  // Helper to construct link with preserved parameters
  const makeAdminLink = (tid: string, type: "sale" | "developer" = "developer") => {
    const params = new URLSearchParams();
    params.set("threadId", tid);
    if (apiUrl) params.set("apiUrl", apiUrl);
    if (assistantId) params.set("assistantId", assistantId);
    if (authScheme) params.set("authScheme", authScheme);
    const basePath = type === "sale" ? "/admin/sale/thread" : "/admin/thread";
    return `${basePath}?${params.toString()}`;
  };

  // Connect to SSE for real-time thread creation events
  useEffect(() => {
    if (!apiUrl) return;

    const url = `${apiUrl}/api/events/admin`;
    console.log("[SSE] Connecting to:", url);
    const eventSource = new EventSource(url);

    const handleEventData = (dataStr: string) => {
      try {
        const payload = JSON.parse(dataStr);
        console.log("[SSE] New thread event received:", payload);
        
        toast("New Thread Created", {
          description: `Thread ID: ${payload.thread_id}`,
          action: {
            label: "Observe",
            onClick: () => {
              router.push(makeAdminLink(payload.thread_id));
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

        // Auto-refresh dashboard data
        fetchDashboardData();
      } catch (err) {
        console.error("[SSE] Error parsing event data:", err);
      }
    };

    // Listen for default message events
    eventSource.onmessage = (event) => {
      handleEventData(event.data);
    };

    // Listen for custom 'THREAD_CREATED' event type
    eventSource.addEventListener("THREAD_CREATED", (event: any) => {
      handleEventData(event.data);
    });

    // Listen for custom 'NEW_MESSAGE' event type
    eventSource.addEventListener("NEW_MESSAGE", (event: any) => {
      try {
        const payload = JSON.parse(event.data);
        console.log("[SSE] NEW_MESSAGE event received:", payload);
        const threadId = payload.thread_id;

        if (threadId) {
          toast("New Message Received", {
            description: `Thread ID: ${threadId}`,
            action: {
              label: "Observe",
              onClick: () => {
                router.push(makeAdminLink(threadId));
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

          // Fetch latest message for the thread immediately
          fetchAndUpdateThread(threadId);

          // Auto-refresh dashboard data (updates list ordering, other statuses)
          fetchDashboardData();
        }
      } catch (err) {
        console.error("[SSE] Error parsing NEW_MESSAGE data:", err);
      }
    });

    // Listen for custom 'TRANSFER_TO_HUMAN' event type
    eventSource.addEventListener("TRANSFER_TO_HUMAN", (event: any) => {
      try {
        const payload = JSON.parse(event.data);
        console.log("[SSE] TRANSFER_TO_HUMAN event received:", payload);
        
        toast("Transfer to Human Support", {
          description: `Customer transferred to ${payload.staff_id}`,
          action: {
            label: "Observe",
            onClick: () => {
              router.push(makeAdminLink(payload.customer_thread_id));
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

        // Also add the new staff thread to sseCreatedAssignees so it shows as "staff"
        if (payload.staff_thread_id) {
          setSseCreatedAssignees(prev => ({
            ...prev,
            [payload.staff_thread_id]: "staff"
          }));
        }

        // Fetch latest message for transferee thread immediately
        fetchAndUpdateThread(payload.customer_thread_id);

        // Auto-refresh dashboard data
        fetchDashboardData();
      } catch (err) {
        console.error("[SSE] Error parsing TRANSFER_TO_HUMAN data:", err);
      }
    });

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        console.log("[SSE] Connection closed by server or failed.");
      } else if (eventSource.readyState === EventSource.CONNECTING) {
        console.warn("[SSE] Connection lost, reconnecting to SSE...");
      } else {
        console.error("[SSE] EventSource error occurred.");
      }
    };

    return () => {
      console.log("[SSE] Closing connection to:", url);
      eventSource.close();
    };
  }, [apiUrl, fetchDashboardData, fetchAndUpdateThread, router]);

  // Filtered and sorted customer threads (newest first)
  const filteredCustomerThreads = customerThreads.filter(item => {
    // 1. Search Query Filter
    const term = searchQuery.toLowerCase();
    const isGuest = item.namespace.includes("guest_threads");

    if (term) {
      const matchesSearch = 
        item.key.toLowerCase().includes(term) ||
        item.value.threads.some(t => {
          const tid = t.thread_id || item.key;
          return tid.toLowerCase().includes(term);
        });

      if (!matchesSearch) return false;
    }

    // 2. Member / Guest Filter
    if (customerFilter === "all") return true;
    if (customerFilter === "guest") return isGuest;
    if (customerFilter === "member") return !isGuest;

    return true;
  }).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  // Filtered and sorted staff threads (newest first)
  const filteredStaffThreads = staffThreads.filter(item => {
    const term = searchQuery.toLowerCase();
    if (!term) return true;
    return (
      item.key.toLowerCase().includes(term) ||
      item.value.threads.some(
        t =>
          t.thread_id.toLowerCase().includes(term) ||
          t.customer_thread_id.toLowerCase().includes(term)
      )
    );
  }).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  // Split the monitoring parameter into an array of thread IDs
  const monitoredIds = useMemo(() => {
    return monitoring ? monitoring.split(",").filter(Boolean) : [];
  }, [monitoring]);

  // Compute number of columns if gridCols is 0 (Auto)
  const resolvedCols = useMemo(() => {
    if (gridCols > 0) return gridCols;
    const len = monitoredIds.length;
    if (len <= 1) return 1;
    if (len === 2) return 2;
    if (len === 4) return 2;
    return 3; // default to 3 columns for 3, 5, 6, or more threads
  }, [monitoredIds, gridCols]);

  if (monitoredIds.length > 0) {
    return (
      <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 font-sans animate-in fade-in duration-300">
        <div className="mx-auto max-w-7xl flex flex-col gap-6">
          
          {/* Top Bar for Monitoring Grid */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-100 p-5 rounded-2xl shadow-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMonitoring(null)}
                className="group flex items-center justify-center h-10 w-10 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                title="Back to Dashboard"
              >
                <ArrowRight className="size-4 rotate-180 group-hover:-translate-x-0.5 transition-transform" />
              </button>
              <div className="flex flex-col">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                  <Activity className="size-5 text-indigo-600 animate-pulse" />
                  Multi-Thread Agent Monitor
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Currently watching {monitoredIds.length} active agent sessions
                </p>
              </div>
            </div>

            {/* Grid layout controls */}
            <div className="flex items-center gap-4 self-end md:self-auto text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Columns</span>
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setGridCols(0)}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      gridCols === 0 ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Auto
                  </button>
                  <button
                    onClick={() => setGridCols(1)}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      gridCols === 1 ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    1
                  </button>
                  <button
                    onClick={() => setGridCols(2)}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      gridCols === 2 ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    2
                  </button>
                  <button
                    onClick={() => setGridCols(3)}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      gridCols === 3 ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    3
                  </button>
                </div>
              </div>
              <button
                onClick={() => setMonitoring(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-xs transition-all hover:scale-102"
              >
                Exit Monitor
              </button>
            </div>
          </div>

          {/* Grid View */}
          <div className={`grid gap-6 grid-cols-1 ${
            resolvedCols === 2 ? "md:grid-cols-2" : 
            resolvedCols === 3 ? "md:grid-cols-2 lg:grid-cols-3" : ""
          }`}>
            {monitoredIds.map((tid: string) => (
              <MiniThreadMonitor
                key={tid}
                threadId={tid}
                apiUrl={apiUrl}
                assistantId={assistantId}
                authScheme={authScheme || undefined}
                makeAdminLink={makeAdminLink}
              />
            ))}
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${colors.background} p-6 md:p-8 font-sans admin-theme`}>
      <div className="mx-auto max-w-7xl flex flex-col gap-6">
        
        {/* Top Header Panel */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-100 p-6 rounded-2xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600">
              <Shield className="size-6 animate-pulse" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                LangGraph Admin Dashboard
              </h1>
              <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Database className="size-3.5 text-slate-400" />
                Store monitoring dashboard for customer and staff threads
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end md:self-auto">
            <div className="hidden sm:flex flex-col items-end text-xs text-slate-400">
              <span className="font-medium text-slate-600">Deployment URL</span>
              <span className="truncate max-w-[200px]">{apiUrl}</span>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchDashboardData}
              disabled={isLoading}
              className="rounded-xl border-slate-200 hover:bg-slate-50 h-10 w-10 flex items-center justify-center transition-all"
              title="Refresh Dashboard"
            >
              <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>

            {/* Real-time Notifications Popover */}
            <div className="relative">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  // Mark all notifications as read when opening dropdown
                  setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                }}
                className="relative rounded-xl border-slate-200 hover:bg-slate-50 h-10 w-10 flex items-center justify-center transition-all"
                title="Notifications"
              >
                <Bell className="size-4 text-slate-600" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white animate-pulse">
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </Button>
              
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100/50">
                    <span className="font-bold text-slate-700 text-sm">Notifications</span>
                    {notifications.length > 0 && (
                      <button 
                        onClick={() => setNotifications([])}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-250 [&::-webkit-scrollbar-track]:bg-transparent">
                    {notifications.length === 0 ? (
                      <div className="py-8 px-4 text-center text-xs text-slate-400">
                        No new notifications
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className="px-4 py-3 border-b border-slate-50 last:border-b-0 hover:bg-slate-50 transition-colors flex flex-col gap-1">
                          <div className="flex items-start justify-between gap-1">
                            {n.type === "TRANSFER" ? (
                              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Transfer Support</span>
                            ) : n.type === "MESSAGE" ? (
                              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">New Message</span>
                            ) : (
                              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">New Thread</span>
                            )}
                            <span className="text-[9px] text-slate-400 font-medium">{formatTime(n.created_at)}</span>
                          </div>
                          {n.type === "TRANSFER" ? (
                            <span className="text-xs text-slate-500 leading-normal mt-0.5">
                              Customer transferred to <strong className="font-semibold text-slate-700">{n.staff_id}</strong>
                            </span>
                          ) : n.type === "MESSAGE" ? (
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              <span className="text-[10px] font-mono text-slate-500 break-all select-all block leading-normal" title={n.thread_id}>
                                {n.thread_id}
                              </span>
                              <span className="text-[10px] text-slate-400 italic truncate max-w-[250px]" title={threadMetadata[n.thread_id]?.lastMessage}>
                                {threadMetadata[n.thread_id]?.lastMessage || "Loading message..."}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-500 break-all select-all block leading-normal mt-0.5" title={n.thread_id}>
                              {n.thread_id}
                            </span>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[11px] w-full text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 justify-start px-2 mt-1 rounded-lg gap-1"
                            onClick={() => {
                              setShowNotifications(false);
                              router.push(makeAdminLink(n.thread_id));
                            }}
                          >
                            <Eye className="size-3" />
                            Observe Chat
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowSettings(true)}
              className="rounded-xl border-slate-200 hover:bg-slate-50 h-10 w-10 flex items-center justify-center transition-all"
              title="Connection Settings"
            >
              <Settings className="size-4 text-slate-600" />
            </Button>
          </div>
        </div>

        {/* Error Alert Box */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-start gap-3 text-rose-700 animate-in fade-in duration-200">
            <AlertTriangle className="size-5 mt-0.5 flex-shrink-0" />
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-sm">Connection Error</span>
              <span className="text-xs font-normal opacity-90">{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Control bar: Tabs & Search Filter */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl self-start">
            <button
              onClick={() => setActiveTab("customer")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === "customer" 
                  ? "bg-white text-indigo-600 shadow-xs" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <User className="size-4" />
              Customer Threads
              <span className="bg-slate-200 text-slate-800 text-[10px] font-semibold px-2 py-0.5 rounded-full ml-1">
                {customerThreads.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("staff")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === "staff" 
                  ? "bg-white text-indigo-600 shadow-xs" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Users className="size-4" />
              Staff Threads
              <span className="bg-slate-200 text-slate-800 text-[10px] font-semibold px-2 py-0.5 rounded-full ml-1">
                {staffThreads.reduce((acc, curr) => acc + (curr.value.threads?.length || 0), 0)}
              </span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            {activeTab === "customer" && (
              <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
                <button
                  onClick={() => setCustomerFilter("all")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    customerFilter === "all"
                      ? "bg-white text-indigo-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setCustomerFilter("member")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    customerFilter === "member"
                      ? "bg-white text-indigo-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Members
                </button>
                <button
                  onClick={() => setCustomerFilter("guest")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    customerFilter === "guest"
                      ? "bg-white text-indigo-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Guests
                </button>
              </div>
            )}

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search thread ID or key..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 pl-10 pr-4 py-2 text-sm rounded-xl outline-none focus:border-indigo-500 shadow-2xs transition-all"
              />
            </div>
          </div>
        </div>

        {/* List Content */}
        {activeTab === "customer" ? (
          /* Customer Threads Grid */
          isLoading && filteredCustomerThreads.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((idx) => (
                <Card key={idx} className="bg-white border border-slate-100 flex flex-col justify-between p-5 gap-4">
                  <div className="flex items-center justify-between">
                    <div className="h-4 bg-slate-100 rounded-md w-12 animate-pulse" />
                    <div className="h-4 bg-slate-100 rounded-md w-16 animate-pulse" />
                  </div>
                  <div className="h-4 bg-slate-100 rounded-md w-3/4 animate-pulse mt-2" />
                  <div className="h-3 bg-slate-50 rounded-md w-24 animate-pulse" />
                  <div className="flex flex-col gap-2 border-t border-slate-50 pt-4">
                    <div className="h-10 bg-slate-100 rounded-xl w-full animate-pulse" />
                    <div className="h-3 bg-slate-50 rounded-md w-1/2 animate-pulse mt-1" />
                    <div className="h-8 bg-slate-100 rounded-lg w-full animate-pulse mt-2" />
                  </div>
                </Card>
              ))}
            </div>
          ) : filteredCustomerThreads.length === 0 ? (
            <div className="bg-white border border-slate-100 p-12 rounded-2xl shadow-xs text-center flex flex-col items-center justify-center gap-3">
              <Activity className="size-8 text-slate-300" />
              <p className="text-slate-500 font-medium">No customer threads found</p>
              <span className="text-xs text-slate-400">Wait for guests to start conversations or try refreshing.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCustomerThreads.map((item) => (
                <Card key={item.key} className="bg-white border border-slate-100 hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                  <CardHeader className="pb-3 border-b border-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        {item.namespace.includes("guest_threads") ? "Guest" : "Member"}
                      </span>
                      {(() => {
                        const threadId = item.value.threads?.[0]?.thread_id || item.key;
                        const originalAssignee = threadMetadata[threadId]?.assignee || "";
                        const displayAssignee = getThreadAssignee(threadId, originalAssignee);
                        const displayLabel = displayAssignee === "human" ? "staff" : displayAssignee;
                        return (
                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${getAssigneeBadgeStyles(displayAssignee)}`}>
                            {displayLabel || "Loading..."}
                          </span>
                        );
                      })()}
                    </div>
                    <CardTitle className="text-sm font-bold text-slate-800 mt-3 truncate" title={item.key}>
                      {item.key}
                    </CardTitle>
                    <CardDescription className="text-slate-400 flex items-center gap-1 text-[11px] mt-1">
                      <Clock className="size-3" />
                      Updated {formatTime(item.updated_at)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4 flex flex-col gap-4">
                    {item.value.threads && item.value.threads.length > 0 ? (
                      item.value.threads.map((thread, idx) => {
                        const threadId = thread.thread_id || item.key;
                        return (
                          <div key={threadId || idx} className="flex flex-col gap-2 p-3 bg-slate-50/70 border border-slate-100 rounded-xl relative group">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Thread ID</span>
                                <span className="text-xs font-mono font-medium text-slate-600 truncate block" title={threadId}>
                                  {threadId}
                                </span>
                              </div>
                              <input
                                type="checkbox"
                                checked={selectedThreadIds.includes(threadId)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedThreadIds(prev => [...prev, threadId]);
                                  } else {
                                    setSelectedThreadIds(prev => prev.filter(id => id !== threadId));
                                  }
                                }}
                                className="size-4 mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-550 cursor-pointer accent-indigo-600"
                              />
                            </div>
                            <div className="flex flex-col gap-0.5 mt-1 bg-white p-2 border border-slate-100 rounded-lg">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Last Message</span>
                              <span className="text-[11px] text-slate-600 line-clamp-2 italic font-normal" title={threadMetadata[threadId]?.lastMessage}>
                                {threadMetadata[threadId]?.lastMessage || "Loading..."}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100/50">
                              <User className="size-3.5 text-slate-400" />
                              <span className="font-semibold text-slate-400 text-[9px] uppercase">Assignee:</span>
                              <span className="font-medium text-slate-700">
                                {getAssigneeLabel(threadMetadata[threadId], threadId, staffThreads)}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs hover:scale-102 transition-all mt-1 flex items-center justify-center gap-1.5"
                              asChild
                            >
                              <Link href={makeAdminLink(threadId)}>
                                <Eye className="size-3.5" />
                                Observe Chat
                              </Link>
                            </Button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex flex-col gap-2 p-3 bg-slate-50/70 border border-slate-100 rounded-xl relative">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Thread ID</span>
                            <span className="text-xs font-mono font-medium text-slate-600 truncate block" title={item.key}>
                              {item.key}
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={selectedThreadIds.includes(item.key)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedThreadIds(prev => [...prev, item.key]);
                              } else {
                                setSelectedThreadIds(prev => prev.filter(id => id !== item.key));
                              }
                            }}
                            className="size-4 mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-550 cursor-pointer accent-indigo-600"
                          />
                        </div>
                        <div className="flex flex-col gap-0.5 mt-1 bg-white p-2 border border-slate-100 rounded-lg">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Last Message</span>
                          <span className="text-[11px] text-slate-600 line-clamp-2 italic font-normal" title={threadMetadata[item.key]?.lastMessage}>
                            {threadMetadata[item.key]?.lastMessage || "Loading..."}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100/50">
                          <User className="size-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-400 text-[9px] uppercase">Assignee:</span>
                          <span className="font-medium text-slate-700">
                            {getAssigneeLabel(threadMetadata[item.key], item.key, staffThreads)}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs hover:scale-102 transition-all mt-1 flex items-center justify-center gap-1.5"
                          asChild
                        >
                          <Link href={makeAdminLink(item.key)}>
                            <Eye className="size-3.5" />
                            Observe Chat
                          </Link>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : (
          /* Staff Threads (Groups support users) */
          isLoading && filteredStaffThreads.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((idx) => (
                <Card key={idx} className="bg-white border border-slate-100 flex flex-col justify-between p-5 gap-4">
                  <div className="flex items-center justify-between">
                    <div className="h-4 bg-slate-100 rounded-md w-16 animate-pulse" />
                    <div className="h-4 bg-slate-100 rounded-md w-12 animate-pulse" />
                  </div>
                  <div className="h-4 bg-slate-100 rounded-md w-3/4 animate-pulse mt-2" />
                  <div className="h-3 bg-slate-50 rounded-md w-24 animate-pulse" />
                  <div className="flex flex-col gap-2 border-t border-slate-50 pt-4">
                    <div className="h-10 bg-slate-100 rounded-xl w-full animate-pulse" />
                    <div className="h-3 bg-slate-50 rounded-md w-1/2 animate-pulse mt-1" />
                    <div className="h-8 bg-slate-100 rounded-lg w-full animate-pulse mt-2" />
                  </div>
                </Card>
              ))}
            </div>
          ) : filteredStaffThreads.length === 0 ? (
            <div className="bg-white border border-slate-100 p-12 rounded-2xl shadow-xs text-center flex flex-col items-center justify-center gap-3">
              <Activity className="size-8 text-slate-300" />
              <p className="text-slate-500 font-medium">No staff threads found</p>
              <span className="text-xs text-slate-400">Assigned support threads will appear here.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {filteredStaffThreads.map((item) => (
                <div key={item.key} className="bg-white border border-slate-100 rounded-2xl shadow-2xs overflow-hidden">
                  <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg">
                        <Users className="size-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 text-sm sm:text-base">{item.key}</span>
                        <span className="text-[11px] text-slate-400 mt-0.5">
                          Support Agent • Updated {formatTime(item.updated_at)}
                        </span>
                      </div>
                    </div>
                    <span className="bg-slate-200/60 text-slate-700 text-[10px] sm:text-xs font-semibold px-3 py-1 rounded-full self-start sm:self-auto">
                      {item.value.threads?.length || 0} Threads Assigned
                    </span>
                  </div>

                  <div className="p-6 overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-[10px] font-bold text-slate-400 uppercase pb-3 w-1/4">Staff Thread ID</th>
                          <th className="text-[10px] font-bold text-slate-400 uppercase pb-3 w-1/4">Customer Thread ID</th>
                          <th className="text-[10px] font-bold text-slate-400 uppercase pb-3 w-1/6">Status</th>
                          <th className="text-[10px] font-bold text-slate-400 uppercase pb-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...item.value.threads]
                          .sort((a, b) => {
                            const matchA = customerThreads.find(c => 
                              c.value.threads.some(t => t.thread_id === a.customer_thread_id)
                            );
                            const matchB = customerThreads.find(c => 
                              c.value.threads.some(t => t.thread_id === b.customer_thread_id)
                            );
                            const timeA = matchA ? matchA.updated_at : item.updated_at;
                            const timeB = matchB ? matchB.updated_at : item.updated_at;
                            return new Date(timeB).getTime() - new Date(timeA).getTime();
                          })
                          .map((thread) => (
                          <tr key={thread.thread_id} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/20 transition-all">
                            <td className="py-4 pr-4">
                              <div className="flex items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedThreadIds.includes(thread.thread_id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedThreadIds(prev => [...prev, thread.thread_id]);
                                    } else {
                                      setSelectedThreadIds(prev => prev.filter(id => id !== thread.thread_id));
                                    }
                                  }}
                                  className="size-3.5 mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                                />
                                <div className="min-w-0 flex-1">
                                  <span className="text-xs font-mono font-medium text-slate-600 block truncate max-w-[180px]" title={thread.thread_id}>
                                    {thread.thread_id}
                                  </span>
                                  <span className="text-[10px] text-slate-500 block truncate max-w-[180px] italic mt-1" title={threadMetadata[thread.thread_id]?.lastMessage}>
                                    {threadMetadata[thread.thread_id]?.lastMessage || "Loading..."}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 pr-4">
                              <div className="flex items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedThreadIds.includes(thread.customer_thread_id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedThreadIds(prev => [...prev, thread.customer_thread_id]);
                                    } else {
                                      setSelectedThreadIds(prev => prev.filter(id => id !== thread.customer_thread_id));
                                    }
                                  }}
                                  className="size-3.5 mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                                />
                                <div className="min-w-0 flex-1">
                                  <span className="text-xs font-mono font-medium text-slate-600 block truncate max-w-[180px]" title={thread.customer_thread_id}>
                                    {thread.customer_thread_id}
                                  </span>
                                  <span className="text-[10px] text-slate-500 block truncate max-w-[180px] italic mt-1" title={threadMetadata[thread.customer_thread_id]?.lastMessage}>
                                    {threadMetadata[thread.customer_thread_id]?.lastMessage || "Loading..."}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block mt-1">
                                    Assignee: <strong className="text-slate-600 font-semibold">{getAssigneeLabel(threadMetadata[thread.customer_thread_id], thread.customer_thread_id, staffThreads)}</strong>
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-4">
                              {(() => {
                                const originalAssignee = threadMetadata[thread.thread_id]?.assignee || "";
                                const displayAssignee = getThreadAssignee(thread.thread_id, originalAssignee);
                                const displayLabel = displayAssignee === "human" ? "staff" : displayAssignee;
                                return (
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${getAssigneeBadgeStyles(displayAssignee)}`}>
                                    {displayLabel || "Loading..."}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="py-4 text-right">
                              <div className="flex items-center justify-end gap-2.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-xs flex items-center gap-1 transition-all"
                                  asChild
                                >
                                  <Link href={makeAdminLink(thread.customer_thread_id, "sale")}>
                                    <Eye className="size-3.5" />
                                    Observe Customer
                                  </Link>
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs flex items-center gap-1 transition-all"
                                  asChild
                                >
                                  <Link href={makeAdminLink(thread.thread_id, "developer")}>
                                    <MessageSquare className="size-3.5" />
                                    Observe Staff
                                    <ArrowRight className="size-3" />
                                  </Link>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl border animate-in zoom-in-95 duration-200 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b pb-3">
              <Settings className="size-5 text-indigo-600" />
              <h3 className="font-bold text-lg text-gray-900">Connection Settings</h3>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const newApiUrl = formData.get("apiUrl") as string;
                const newAssistantId = formData.get("assistantId") as string;
                const newAuthScheme = formData.get("authScheme") as string;
                const newApiKey = formData.get("apiKey") as string;

                setApiUrl(newApiUrl || null);
                setAssistantId(newAssistantId || null);
                setAuthScheme(newAuthScheme || null);
                window.localStorage.setItem("lg:chat:apiKey", newApiKey);

                setShowSettings(false);
                // Trigger refresh automatically
                setTimeout(() => {
                  fetchDashboardData();
                }, 100);
              }}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Deployment URL</label>
                <input
                  type="text"
                  name="apiUrl"
                  defaultValue={apiUrl || ""}
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 text-sm rounded-xl outline-none focus:border-indigo-500 transition-all text-slate-800"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Assistant / Graph ID</label>
                <input
                  type="text"
                  name="assistantId"
                  defaultValue={assistantId || ""}
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 text-sm rounded-xl outline-none focus:border-indigo-500 transition-all text-slate-800"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Auth Scheme</label>
                <input
                  type="text"
                  name="authScheme"
                  defaultValue={authScheme || ""}
                  placeholder="e.g. langsmith-api-key"
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 text-sm rounded-xl outline-none focus:border-indigo-500 transition-all text-slate-800"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">LangSmith API Key</label>
                <input
                  type="password"
                  name="apiKey"
                  defaultValue={getApiKey() || ""}
                  placeholder="lsv2_pt_..."
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 text-sm rounded-xl outline-none focus:border-indigo-500 transition-all text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t pt-4 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSettings(false)}
                  className="rounded-xl px-4 py-2 text-sm"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2 text-sm shadow-md transition-all hover:scale-102"
                >
                  Save Settings
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Action Banner for Multi-Thread Monitoring */}
      {selectedThreadIds.length > 0 && !monitoring && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white/90 backdrop-blur-md border border-slate-250/80 shadow-xl px-6 py-4 rounded-2xl flex items-center gap-6 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-800">
              {selectedThreadIds.length} threads selected
            </span>
            <span className="text-xs text-slate-500">
              Ready to monitor in a multi-thread grid
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedThreadIds([])}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
              type="button"
            >
              Clear
            </button>
            <button
              onClick={() => {
                setMonitoring(selectedThreadIds.join(","));
                setSelectedThreadIds([]);
              }}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all hover:scale-102 flex items-center gap-1.5"
              type="button"
            >
              <Activity className="size-3.5 animate-pulse text-white" />
              Start Monitoring
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-xs text-slate-500 font-bold">Đang tải dashboard...</div>}>
      <AdminDashboardContent />
    </React.Suspense>
  );
}
