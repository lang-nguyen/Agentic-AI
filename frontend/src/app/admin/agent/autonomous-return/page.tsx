"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Bot, 
  Settings2, 
  Activity, 
  Save, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  HelpCircle,
  FileText,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
  Cpu,
  Terminal as TerminalIcon,
  Settings,
  MessageSquare,
  ArrowLeft
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/common/ui/card";
import { Button } from "@/components/common/ui/button";
import { toast } from "sonner";
import { Toaster } from "@/components/common/ui/sonner";
import { API_CONFIG } from "@/config/api";
import Link from "next/link";

interface AgentConfig {
  agentic_enabled: boolean;
  instruction: string;
  policy: string;
}

interface AgentLog {
  timestamp: string;
  return_id: string;
  status: string;
  action: string;
  order_id: string;
  reason: string;
  comment: string;
}

export default function AutonomousAgentDetailPage() {
  const [config, setConfig] = useState<AgentConfig>({
    agentic_enabled: true,
    instruction: "",
    policy: ""
  });
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Settings modal state
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  
  // On-demand Observability trace loading state
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [traceMap, setTraceMap] = useState<Record<string, any[]>>({});
  const [loadingTraceId, setLoadingTraceId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<"messages" | "reasoning" | "tools">("messages");

  const fetchConfig = useCallback(async () => {
    try {
      setLoadingConfig(true);
      const res = await fetch(`${API_CONFIG.rulesEngineBaseUrl}/api/smart-return/agent/config`);
      if (!res.ok) throw new Error("Failed to fetch agent config");
      const data = await res.json();
      setConfig(data);
    } catch (err: any) {
      console.error(err);
      toast.error("Không thể tải cấu hình Agent");
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      setLoadingLogs(true);
      const res = await fetch(`${API_CONFIG.rulesEngineBaseUrl}/api/smart-return/agent/logs`);
      if (!res.ok) throw new Error("Failed to fetch agent logs");
      const data = await res.json();
      setLogs(data);
    } catch (err: any) {
      console.error(err);
      toast.error("Không thể tải nhật ký hoạt động");
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  const fetchQueue = useCallback(async () => {
    try {
      setLoadingQueue(true);
      const res = await fetch(`${API_CONFIG.rulesEngineBaseUrl}/api/smart-return/agent/queue`);
      if (!res.ok) throw new Error("Failed to fetch agent queue");
      const data = await res.json();
      setQueue(data);
    } catch (err: any) {
      console.error(err);
      toast.error("Không thể tải hàng đợi xử lý");
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  // Load trace on-demand when expanding log row
  const fetchTrace = async (returnId: string) => {
    if (traceMap[returnId]) return; // already loaded
    try {
      setLoadingTraceId(returnId);
      const res = await fetch(`${API_CONFIG.rulesEngineBaseUrl}/api/smart-return/agent/trace/${returnId}`);
      if (!res.ok) throw new Error("Failed to fetch trace");
      const data = await res.json();
      setTraceMap(prev => ({ ...prev, [returnId]: data.messages || [] }));
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải chi tiết hội thoại của Agent");
    } finally {
      setLoadingTraceId(null);
    }
  };

  const handleToggleExpand = (returnId: string) => {
    if (expandedLogId === returnId) {
      setExpandedLogId(null);
    } else {
      setExpandedLogId(returnId);
      fetchTrace(returnId);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchLogs();
    fetchQueue();

    // Establish Server-Sent Events (SSE) for true real-time updates
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`${API_CONFIG.rulesEngineBaseUrl}/api/events/admin`);
      
      const handleRealtimeUpdate = () => {
        fetchLogs();
        fetchQueue();
        // If there's an expanded trace log, refresh it too
        if (expandedLogId) {
          setTraceMap(prev => {
            const copy = { ...prev };
            delete copy[expandedLogId];
            return copy;
          });
          fetchTrace(expandedLogId);
        }
      };

      eventSource.addEventListener("AGENT_UPDATE", handleRealtimeUpdate);
      eventSource.addEventListener("THREAD_CREATED", handleRealtimeUpdate);
      eventSource.addEventListener("NEW_MESSAGE", handleRealtimeUpdate);

      eventSource.onerror = (err) => {
        console.warn("SSE connection error on Agent page, using polling backup:", err);
      };
    } catch (err) {
      console.warn("Failed to connect EventSource on Agent page:", err);
    }
    
    // Auto-refresh logs & queue every 15 seconds as a safety backup
    const interval = setInterval(() => {
      fetchLogs();
      fetchQueue();
    }, 15000);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(interval);
    };
  }, [fetchConfig, fetchLogs, fetchQueue, expandedLogId]);

  // Automatically expand log for returnId passed in URL query parameter
  useEffect(() => {
    if (typeof window !== "undefined" && logs.length > 0) {
      const searchParams = new URLSearchParams(window.location.search);
      const urlReturnId = searchParams.get("returnId");
      if (urlReturnId) {
        const matchedLog = logs.find(log => log.return_id === urlReturnId);
        if (matchedLog) {
          setExpandedLogId(urlReturnId);
          fetchTrace(urlReturnId);
          
          // Scroll the highlighted log into view smoothly
          setTimeout(() => {
            const el = document.getElementById(`log-card-${urlReturnId}`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }, 500);
        }
      }
    }
  }, [logs]);

  const handleToggleAgent = async () => {
    try {
      const res = await fetch(`${API_CONFIG.rulesEngineBaseUrl}/api/smart-return/agent/toggle`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Failed to toggle agent status");
      const data = await res.json();
      setConfig(prev => ({ ...prev, agentic_enabled: data.agentic_enabled }));
      toast.success(data.agentic_enabled ? "Đã BẬT xử lý đổi trả tự động" : "Đã TẮT xử lý đổi trả tự động");
    } catch (err: any) {
      console.error(err);
      toast.error("Không thể thay đổi trạng thái Agent");
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch(`${API_CONFIG.rulesEngineBaseUrl}/api/smart-return/agent/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      if (!res.ok) throw new Error("Failed to update config");
      const data = await res.json();
      setConfig(data);
      setIsSettingsModalOpen(false);
      toast.success("Cập nhật cấu hình và chính sách của AI Agent thành công!");
    } catch (err: any) {
      console.error(err);
      toast.error("Không thể lưu cấu hình");
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === "APPROVED") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[9px] font-extrabold text-emerald-600 border border-emerald-100">
          <CheckCircle className="size-3" />
          Duyệt Hoàn Tiền
        </span>
      );
    }
    if (s === "REJECTED") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[9px] font-extrabold text-rose-600 border border-rose-100">
          <XCircle className="size-3" />
          Từ Chối
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[9px] font-extrabold text-amber-600 border border-amber-100 animate-pulse">
        <Clock className="size-3" />
        Đang Xếp Hàng
      </span>
    );
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "REFUND_IMMEDIATELY":
        return "bg-indigo-50 border-indigo-150 text-indigo-700";
      case "REFUND_AND_RETURN":
        return "bg-emerald-50 border-emerald-150 text-emerald-700";
      case "WAIT_FOR_APPROVAL":
        return "bg-amber-50 border-amber-150 text-amber-700";
      default:
        return "bg-slate-50 border-slate-200 text-slate-600";
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const time = date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
      const calendar = date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
      return `${time} ${calendar}`;
    } catch {
      return isoString;
    }
  };

  const getMessageRole = (msg: any) => {
    if (msg.type === "ai" || msg.role === "assistant") return "assistant";
    if (msg.type === "human" || msg.role === "user") return "user";
    return "system";
  };

  const getReasoningContent = (msg: any) => {
    if (msg.response_metadata?.reasoning_content) {
      return msg.response_metadata.reasoning_content;
    }
    return msg.content || "";
  };

  const getReasoningSteps = (messages: any[]) => {
    return messages.filter(m => getMessageRole(m) === "assistant" && getReasoningContent(m));
  };

  const getToolCalls = (messages: any[]) => {
    const calls: any[] = [];
    messages.forEach(m => {
      if (m.tool_calls && m.tool_calls.length > 0) {
        m.tool_calls.forEach((tc: any) => {
          const toolOutput = messages.find(out => out.type === "tool" && out.tool_call_id === tc.id);
          calls.push({
            name: tc.name,
            args: tc.args,
            output: toolOutput ? toolOutput.content : "Đang thực thi hoặc không có đầu ra..."
          });
        });
      }
    });
    return calls;
  };

  return (
    <div className="min-h-screen bg-slate-55/50 p-6 md:p-8 font-sans admin-theme text-slate-800 flex flex-col gap-6">
      <Toaster position="top-right" />
      
      {/* Breadcrumbs / Back navigation */}
      <div className="flex items-center gap-3 select-none">
        <Link href="/admin/agent">
          <button className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-all cursor-pointer bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-3xs">
            <ArrowLeft className="size-3.5" />
            Quay lại Quản lý Agent
          </button>
        </Link>
        <span className="text-slate-300">|</span>
        <span className="text-xs font-bold text-slate-400">Autonomous Return Detail</span>
      </div>

      {/* Title Header Panel */}
      <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-2xs text-left flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-3xs shrink-0 text-emerald-600">
            <Bot className="h-6 w-6 animate-bounce-slow" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-850 tracking-tight flex items-center gap-2">
              Autonomous Return Agent
            </h1>
            <p className="text-xs text-slate-400 font-bold mt-1">
              Chi tiết nhật ký hoạt động, hàng đợi chờ xử lý, vết suy luận và các cấu hình của Tác tử Tự chủ.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button 
            variant="outline" 
            onClick={() => {
              fetchConfig();
              fetchLogs();
              fetchQueue();
              toast.success("Đã làm mới dữ liệu Agent");
            }}
            className="bg-slate-55 hover:bg-slate-100 text-slate-700 rounded-xl px-4 py-2 text-xs font-extrabold flex items-center justify-center gap-2 border border-slate-200 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Làm Mới
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => setIsSettingsModalOpen(true)}
            className="bg-slate-55 hover:bg-slate-100 text-slate-700 rounded-xl px-4 py-2 text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer border border-slate-200"
          >
            <Settings className="h-3.5 w-3.5 text-slate-500 animate-spin-hover" />
            Cấu Hình Agent
          </Button>
          
          <Button
            onClick={handleToggleAgent}
            className={`rounded-xl px-5 py-3 text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-3xs border-none text-white ${
              config.agentic_enabled 
                ? "bg-indigo-600 hover:bg-indigo-700" 
                : "bg-rose-600 hover:bg-rose-700"
            }`}
          >
            {config.agentic_enabled ? (
              <>
                <ToggleRight className="h-4.5 w-4.5" />
                <span>Agent Đang Bật</span>
              </>
            ) : (
              <>
                <ToggleLeft className="h-4.5 w-4.5" />
                <span>Agent Đang Tắt</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Split Layout: Queue and Logs */}
      <div className="flex-1 min-h-0 w-full flex flex-col lg:flex-row gap-4 items-stretch overflow-hidden">
        
        {/* Queue Panel (1/3 width) */}
        <Card className="bg-white border-slate-100 shadow-2xs rounded-2xl overflow-hidden text-left h-full flex flex-col w-full lg:w-1/3">
          <div className="bg-slate-55 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <span className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              Hàng Đợi Chờ Xử Lý (Queue)
            </span>
            {config.agentic_enabled && queue.length > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 text-[9px] font-extrabold text-blue-600 border border-blue-150 animate-pulse">
                AI Active
              </span>
            )}
          </div>
          
          <CardContent className="p-6 flex flex-col gap-4 flex-1 overflow-y-auto bg-slate-55/10">
            {loadingQueue && queue.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full space-y-2 text-slate-400">
                <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
                <p className="text-xs">Đang tải hàng đợi...</p>
              </div>
            ) : queue.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full space-y-2 text-slate-400 py-10 select-none text-center">
                <Bot className="h-8 w-8 text-slate-300" />
                <p className="text-xs font-bold text-slate-455">Hàng đợi đang trống</p>
                <p className="text-[10px] text-slate-400 px-4 leading-relaxed mt-0.5">
                  Mọi yêu cầu đổi trả mới sẽ xếp hàng ở đây để Agent xử lý tự chủ.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {queue.map((req, qIdx) => (
                  <div 
                    key={qIdx}
                    className="p-3.5 rounded-xl border border-slate-150 bg-white shadow-3xs flex flex-col gap-2 relative overflow-hidden"
                  >
                    {config.agentic_enabled && (
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 animate-pulse" />
                    )}
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[9px] text-slate-400 font-extrabold block">ID: {req.returnId || req.id}</span>
                        <span className="text-xs font-black text-slate-800">
                          Đơn hàng: {req.orderId}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-extrabold text-blue-600 border border-blue-100 animate-pulse">
                        Đang xếp hàng
                      </span>
                    </div>
                    
                    <div className="border-t border-slate-100 pt-2 text-[10px] text-slate-550 leading-relaxed font-semibold">
                      <p className="line-clamp-2 italic">
                        "{req.items?.[0]?.customerComment || "Không có lý do chi tiết"}"
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logs panel (2/3 width) */}
        <Card className="bg-white border-slate-100 shadow-2xs rounded-2xl overflow-hidden text-left h-full flex flex-col w-full lg:w-2/3">
          <div className="bg-slate-55 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <span className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-600 animate-pulse" />
              Activity & Decision Logs
            </span>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={fetchLogs}
              disabled={loadingLogs}
              className="text-slate-500 hover:text-slate-700"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingLogs ? "animate-spin" : ""}`} />
            </Button>
          </div>
          
          <CardContent className="p-6 flex flex-col gap-4 flex-1 overflow-y-auto bg-slate-55/30">
            {loadingLogs && logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full space-y-2 text-slate-400">
                <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
                <p className="text-xs">Đang tải nhật ký...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full space-y-2 text-slate-400 py-10 select-none">
                <HelpCircle className="h-8 w-8 text-slate-300" />
                <p className="text-xs">Chưa có hoạt động nào được ghi nhận</p>
              </div>
            ) : (
              <div className="space-y-4">
                {logs.map((log, idx) => {
                  const isExpanded = expandedLogId === log.return_id;
                  const logTraceMessages = traceMap[log.return_id] || [];
                  const rSteps = getReasoningSteps(logTraceMessages);
                  const tCalls = getToolCalls(logTraceMessages);
                  const isLoadingTrace = loadingTraceId === log.return_id;
                  
                  return (
                     <div 
                       key={idx}
                       id={`log-card-${log.return_id}`}
                       className={`p-4 rounded-2xl border bg-white hover:shadow-xs transition-all duration-200 flex flex-col gap-2.5 ${
                         isExpanded ? "border-indigo-400 shadow-sm animate-pulse-border" : "border-slate-150"
                       }`}
                     >
                       <div 
                         className="flex items-start justify-between flex-wrap gap-2 cursor-pointer"
                         onClick={() => handleToggleExpand(log.return_id)}
                       >
                         <div className="space-y-0.5">
                           <span className="text-[10px] text-slate-400 font-bold block tracking-wide">
                             {formatTime(log.timestamp)}
                           </span>
                           <span className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                             Yêu Cầu: {log.return_id}
                             {isExpanded ? <ChevronUp className="size-3.5 text-slate-400" /> : <ChevronDown className="size-3.5 text-slate-400" />}
                           </span>
                           <span className="text-xs text-slate-455 font-bold block">
                             Mã Đơn Hàng: {log.order_id}
                           </span>
                         </div>
                         <div className="flex items-center gap-1.5">
                           {getStatusBadge(log.status)}
                           <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${getActionColor(log.action)}`}>
                             {log.action}
                           </span>
                         </div>
                       </div>
                       
                       <div className="space-y-1.5 border-t border-slate-100 pt-2.5 text-xs">
                         <p className="text-slate-500 font-medium">
                           <strong className="text-slate-700 font-extrabold">Lý do chính:</strong> {log.reason}
                         </p>
                         <p className="text-slate-500 font-medium">
                           <strong className="text-slate-700 font-extrabold">Ý kiến khách hàng:</strong> "{log.comment}"
                         </p>
                       </div>
 
                       {/* Observability Section */}
                       {isExpanded && (
                         <div className="border-t border-slate-100 pt-3 mt-1 space-y-3 animate-fadeIn duration-200">
                           {isLoadingTrace ? (
                             <div className="flex items-center gap-2 text-slate-400 py-3">
                               <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
                               <span className="text-xs font-semibold">Đang tải lịch sử từ LangGraph Checkpointer...</span>
                             </div>
                           ) : (
                             <>
                               {/* Observability Tabs */}
                               <div className="flex bg-slate-100 p-0.5 rounded-lg w-fit">
                                 <button
                                   onClick={() => setActiveDetailTab("messages")}
                                   className={`px-3 py-1 text-[10px] font-extrabold rounded-md transition-all ${
                                     activeDetailTab === "messages"
                                       ? "bg-white text-indigo-650 shadow-3xs"
                                       : "text-slate-500 hover:text-slate-800"
                                   }`}
                                 >
                                   <MessageSquare className="size-3 inline-block mr-1" />
                                   AI Chat History (Messages)
                                 </button>
                                 <button
                                   onClick={() => setActiveDetailTab("reasoning")}
                                   className={`px-3 py-1 text-[10px] font-extrabold rounded-md transition-all ${
                                     activeDetailTab === "reasoning"
                                       ? "bg-white text-indigo-650 shadow-3xs"
                                       : "text-slate-500 hover:text-slate-800"
                                   }`}
                                 >
                                   <Cpu className="size-3 inline-block mr-1" />
                                   AI Reasoning Logs
                                 </button>
                                 <button
                                   onClick={() => setActiveDetailTab("tools")}
                                   className={`px-3 py-1 text-[10px] font-extrabold rounded-md transition-all ${
                                     activeDetailTab === "tools"
                                       ? "bg-white text-indigo-650 shadow-3xs"
                                       : "text-slate-500 hover:text-slate-800"
                                   }`}
                                 >
                                   <TerminalIcon className="size-3 inline-block mr-1" />
                                   System Tool Calls
                                 </button>
                               </div>
 
                               {/* Detail Tab Contents */}
                               {activeDetailTab === "messages" && (
                                 <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                                   {logTraceMessages.length > 0 ? (
                                     logTraceMessages.map((msg, mIdx) => {
                                       const mRole = getMessageRole(msg);
                                       const isUser = mRole === "user";
                                       const isAssistant = mRole === "assistant";
                                       const reasoningContent = getReasoningContent(msg);
                                       
                                       return (
                                         <div 
                                           key={mIdx}
                                           className={`p-3 rounded-xl border text-xs leading-relaxed ${
                                             isUser 
                                               ? "bg-blue-50/50 border-blue-100 text-blue-800 max-w-[85%] mr-auto" 
                                               : isAssistant 
                                                 ? "bg-indigo-50/50 border-indigo-100 text-indigo-850 max-w-[85%] ml-auto text-left"
                                                 : "bg-slate-900 border-slate-850 text-slate-300 font-mono text-[9px] w-full"
                                           }`}
                                         >
                                           <span className="text-[9px] font-bold block mb-1 opacity-70">
                                             {isUser ? "👤 Khách Hàng / Lệnh Yêu Cầu" : isAssistant ? "🤖 AI Assistant" : `⚡ Hệ Thống (Tool: ${msg.name || "tool"})`}
                                           </span>
                                           
                                           <div className="font-semibold whitespace-pre-wrap break-words">
                                             {msg.content}
                                           </div>
 
                                           {/* Reasoning content */}
                                           {isAssistant && reasoningContent && (
                                             <div className="mt-2 pt-2 border-t border-indigo-100/50 flex flex-col gap-1 text-[10px] text-slate-500">
                                               <span className="font-bold flex items-center gap-1">
                                                 <Cpu className="size-2.5 text-indigo-500" />
                                                 Lập luận suy nghĩ (Thoughts):
                                               </span>
                                               <p className="italic font-medium leading-relaxed bg-white/60 p-2 rounded-lg border border-slate-100/60">
                                                 {reasoningContent}
                                               </p>
                                             </div>
                                           )}
 
                                           {/* Tool calls */}
                                           {msg.tool_calls && msg.tool_calls.length > 0 && (
                                             <div className="mt-2 space-y-1 bg-white/80 p-2 rounded-lg border border-slate-100">
                                               {msg.tool_calls.map((tc: any, tcIdx: number) => (
                                                 <div key={tcIdx} className="text-[10px] space-y-0.5">
                                                   <span className="font-bold text-violet-700">Đang chạy công cụ: {tc.name}</span>
                                                   <span className="text-slate-500 block overflow-x-auto">
                                                     Tham số: {JSON.stringify(tc.args)}
                                                   </span>
                                                 </div>
                                               ))}
                                             </div>
                                           )}
                                         </div>
                                       );
                                     })
                                   ) : (
                                     <div className="text-[11px] text-slate-400 italic">Không tìm thấy tin nhắn nào trong hội thoại.</div>
                                   )}
                                 </div>
                               )}
 
                               {activeDetailTab === "reasoning" && (
                                 <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                                   {rSteps.length > 0 ? (
                                     rSteps.map((step, rIdx) => (
                                       <div key={rIdx} className="p-3 bg-violet-50/20 border border-violet-100 rounded-xl text-xs space-y-1.5 text-slate-700 font-semibold">
                                         <div className="flex items-center gap-1.5 text-violet-700 border-b border-violet-100/40 pb-1">
                                           <Cpu className="size-3.5" />
                                           <span className="font-bold uppercase tracking-wider text-[9px]">Lập Luận Bước {rIdx + 1}</span>
                                         </div>
                                         <p className="italic leading-relaxed whitespace-pre-wrap">{getReasoningContent(step)}</p>
                                       </div>
                                     ))
                                   ) : (
                                     <div className="text-[11px] text-slate-400 italic">Không tìm thấy nhật ký lập luận suy nghĩ (Reasoning) cho yêu cầu này.</div>
                                   )}
                                 </div>
                               )}
 
                               {activeDetailTab === "tools" && (
                                 <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                                   {tCalls.length > 0 ? (
                                     tCalls.map((tc, tIdx) => (
                                       <div key={tIdx} className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl font-mono text-[10px] text-slate-350 space-y-2">
                                         <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 select-none text-emerald-500">
                                           <span className="font-bold flex items-center gap-1">
                                             <TerminalIcon className="size-3.5" />
                                             Công cụ {tIdx + 1}: {tc.name}
                                           </span>
                                         </div>
                                         <div className="space-y-1">
                                           <span className="text-[9px] text-slate-500 font-bold uppercase">Tham số gửi lên (Arguments):</span>
                                           <pre className="bg-slate-950/80 p-2 rounded border border-slate-850 overflow-x-auto text-slate-300">
                                             {JSON.stringify(tc.args, null, 2)}
                                           </pre>
                                         </div>
                                         <div className="space-y-1 pt-1">
                                           <span className="text-[9px] text-slate-500 font-bold uppercase">Kết quả nhận về (Output):</span>
                                           <pre className="bg-slate-950/80 p-2 rounded border border-slate-850 overflow-x-auto text-emerald-350 whitespace-pre-wrap break-all leading-normal max-h-48 overflow-y-auto">
                                             {tc.output}
                                           </pre>
                                         </div>
                                       </div>
                                     ))
                                   ) : (
                                     <div className="text-[11px] text-slate-400 italic">Không ghi nhận cuộc gọi công cụ nào trong hệ thống.</div>
                                   )}
                                 </div>
                               )}
                             </>
                           )}
                         </div>
                       )}
                     </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Settings Configuration Overlay Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs select-none">
          <form 
            onSubmit={handleSaveSettings}
            className="bg-white border border-slate-200 shadow-2xl p-6 max-w-2xl w-full rounded-2xl text-left space-y-4 animate-in fade-in-50 zoom-in-95 duration-150 max-h-[90vh] flex flex-col"
          >
            <div className="shrink-0">
              <h3 className="text-base font-extrabold text-slate-850 flex items-center gap-2">
                <Settings2 className="size-5 text-indigo-650" />
                Cấu hình Autonomous Return Agent
              </h3>
              <p className="text-[11px] text-slate-400 font-semibold mt-1">
                Điều chỉnh các chỉ thị hệ thống và chính sách nghiệp vụ mà AI Agent phải tuân thủ nghiêm ngặt khi tự động duyệt đổi trả.
              </p>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto pr-1 py-1">
              {/* Enable agent status toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="space-y-0.5 text-xs">
                  <span className="font-extrabold text-slate-800 block">Quyền tự quyết của AI Agent</span>
                  <span className="text-[10px] text-slate-400 font-bold block leading-relaxed">
                    Khi bật, AI sẽ tự động phê duyệt/từ chối đơn đổi trả mới mà không cần duyệt thủ công.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, agentic_enabled: !prev.agentic_enabled }))}
                  className="focus:outline-none cursor-pointer"
                >
                  {config.agentic_enabled ? (
                    <ToggleRight className="h-9 w-9 text-indigo-600" />
                  ) : (
                    <ToggleLeft className="h-9 w-9 text-slate-400" />
                  )}
                </button>
              </div>

              {/* Instruction Area */}
              <div className="space-y-1 text-xs">
                <label className="font-extrabold text-slate-700 block">System Instruction (Chỉ thị vận hành)</label>
                <textarea
                  value={config.instruction}
                  onChange={(e) => setConfig(prev => ({ ...prev, instruction: e.target.value }))}
                  placeholder="Ví dụ: Bạn là trợ lý hỗ trợ khách hàng xử lý hoàn trả..."
                  rows={6}
                  className="w-full bg-slate-55 border border-slate-200 p-3 rounded-xl outline-none focus:bg-white focus:border-indigo-500 font-mono text-[11px] leading-relaxed resize-none text-slate-700"
                />
              </div>

              {/* Policy Area */}
              <div className="space-y-1 text-xs">
                <label className="font-extrabold text-slate-700 block">Return & Refund Policy (Chính sách Đổi trả)</label>
                <textarea
                  value={config.policy}
                  onChange={(e) => setConfig(prev => ({ ...prev, policy: e.target.value }))}
                  placeholder="Ví dụ: Chấp nhận hoàn tiền ngay cho các sản phẩm dưới 50 USD..."
                  rows={8}
                  className="w-full bg-slate-55 border border-slate-200 p-3 rounded-xl outline-none focus:bg-white focus:border-indigo-500 font-mono text-[11px] leading-relaxed resize-none text-slate-700"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2 border-t border-slate-100 shrink-0">
              <Button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                variant="outline"
                className="flex-1 rounded-xl text-slate-650 bg-white hover:bg-slate-100 text-xs font-extrabold py-2 cursor-pointer border border-slate-200 text-center"
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="flex-1 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold py-2 cursor-pointer border-none shadow-3xs text-center flex items-center justify-center gap-1.5"
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Save className="h-3 w-3" />
                    Lưu Cấu Hình
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
