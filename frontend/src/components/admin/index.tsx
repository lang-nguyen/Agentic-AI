import { v4 as uuidv4 } from "uuid";
import { ReactNode, useEffect, useRef, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useStreamContext } from "@/providers/Stream";
import { useThreadObserver } from "@/hooks/use-thread-observer";
import { useState, FormEvent } from "react";
import { Button } from "@/components/common/ui/button";
import { Checkpoint, Message } from "@langchain/langgraph-sdk";
import { AssistantMessage, AssistantMessageLoading } from "./messages/ai";
import { HumanMessage } from "./messages/human";
import {
  DO_NOT_RENDER_ID_PREFIX,
  ensureToolCallsHaveResponses,
} from "@/lib/ensure-tool-responses";
import { LangGraphLogoSVG } from "@/components/common/icons/langgraph";
import { TooltipIconButton } from "./tooltip-icon-button";
import {
  ArrowDown,
  LoaderCircle,
  PanelRightOpen,
  PanelRightClose,
  SquarePen,
  XIcon,
  Plus,
  MessageSquare,
  Settings,
  Network,
  Copy,
  Cpu,
  ChevronUp,
  ChevronDown,
  Wrench,
  MoreVertical,
  CheckCircle2,
  Circle,
  Send,
  Activity,
  Shield,
  ArrowRight,
  ArrowLeft,
  Clock,
  Users,
  User,
  AlertCircle,
  FileText,
  ClipboardList,
  Info,
  ChevronRight,
  Star
} from "lucide-react";
import { useQueryState, parseAsBoolean } from "nuqs";
import { MOCK_USERS, MOCK_ORDERS } from "@/data/mockData";
import { translations, Locale } from "@/locales/translations";
import { usePathname, useRouter } from "next/navigation";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import ThreadHistory from "./history";
import { createClient } from "@/providers/client";
import { getApiKey } from "@/lib/api-key";
import { toast } from "sonner";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Label } from "@/components/common/ui/label";
import { Switch } from "@/components/common/ui/switch";
import { GitHubSVG } from "@/components/common/icons/github";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/common/ui/tooltip";
import { useFileUpload } from "@/hooks/use-file-upload";
import { ContentBlocksPreview } from "./ContentBlocksPreview";
import {
  useArtifactOpen,
  ArtifactContent,
  ArtifactTitle,
  useArtifactContext,
} from "./artifact";
import { WorkflowPanel } from "./WorkflowPanel";

function StickyToBottomContent(props: {
  content: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const context = useStickToBottomContext();
  return (
    <div
      ref={context.scrollRef}
      style={{ width: "100%", height: "100%" }}
      className={props.className}
    >
      <div
        ref={context.contentRef}
        className={props.contentClassName}
      >
        {props.content}
      </div>

      {props.footer}
    </div>
  );
}

function ScrollToBottom(props: { className?: string }) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  if (isAtBottom) return null;
  return (
    <Button
      variant="outline"
      className={props.className}
      onClick={() => scrollToBottom()}
    >
      <ArrowDown className="h-4 w-4" />
      <span>Scroll to bottom</span>
    </Button>
  );
}

function OpenGitHubRepo() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href="https://github.com/langchain-ai/agent-chat-ui"
            target="_blank"
            className="flex items-center justify-center"
          >
            <GitHubSVG
              width="24"
              height="24"
            />
          </a>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Open GitHub repo</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function PlaceholderPanel({ isOpen, onClose, message }: { isOpen: boolean; onClose: () => void; message: any }) {
  if (!isOpen || !message) return null;
  return (
    <div className="fixed z-50 right-0 top-0 h-screen bg-white border-l border-slate-200 shadow-2xl flex flex-col overflow-hidden w-[400px]">
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between select-none">
        <span className="font-bold text-slate-800 text-sm">Message Inspector (Placeholder)</span>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-slate-500 hover:bg-slate-200 rounded-lg"
          onClick={onClose}
        >
          <XIcon className="size-4" />
        </Button>
      </div>
      <div className="flex-grow p-6 flex flex-col items-center justify-center text-center gap-3">
        <div className="bg-slate-100 p-4 rounded-full text-slate-400">
          <MessageSquare className="size-8" />
        </div>
        <h4 className="font-bold text-slate-800 text-sm">AI Message Clicked</h4>
        <p className="text-xs text-slate-500 max-w-[280px]">
          This is a temporary placeholder panel opened by clicking an AI message.
        </p>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 w-full text-left mt-4 max-h-[300px] overflow-y-auto">
          <span className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Message Content</span>
          <p className="text-xs text-slate-700 font-mono break-all whitespace-pre-wrap">
            {message.content ? (typeof message.content === "string" ? message.content : JSON.stringify(message.content, null, 2)) : "No content"}
          </p>
        </div>
      </div>
    </div>
  );
}

const highlightJsonText = (rawText: string) => {
  let escaped = rawText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const regex = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"\s*:)|("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*")|(-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)|\b(true|false)\b|\b(null)\b/g;

  return escaped.replace(regex, (match) => {
    let cls = "text-emerald-700 font-medium";
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = "text-indigo-655 font-bold";
      } else {
        cls = "text-slate-700 font-medium";
      }
    } else if (/true|false/.test(match)) {
      cls = "text-blue-600 font-bold";
    } else if (/null/.test(match)) {
      cls = "text-rose-500 font-bold";
    } else {
      cls = "text-amber-700 font-semibold";
    }
    return `<span class="${cls}">${match}</span>`;
  });
};

const formatAndHighlightResponse = (content: any, isError: boolean) => {
  if (content === undefined || content === null) return null;

  let rawText = "";
  let isJson = false;

  if (typeof content === "object") {
    try {
      rawText = JSON.stringify(content, null, 2);
      isJson = true;
    } catch {
      rawText = String(content);
    }
  } else if (typeof content === "string") {
    const trimmed = content.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        const parsed = JSON.parse(trimmed);
        rawText = JSON.stringify(parsed, null, 2);
        isJson = true;
      } catch {
        rawText = content;
      }
    } else {
      rawText = content;
    }
  } else {
    rawText = String(content);
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(rawText);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="relative group w-full">
      {isJson ? (
        <pre 
          dangerouslySetInnerHTML={{ __html: highlightJsonText(rawText) }}
          className="text-[11.5px] font-mono bg-slate-50 text-slate-800 p-3 pr-9 rounded-xl overflow-x-auto leading-normal whitespace-pre max-h-40 border border-slate-200 shadow-3xs [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-350 [&::-webkit-scrollbar-track]:bg-transparent"
        />
      ) : (
        <div className={cn(
          "text-[11.5px] leading-relaxed p-3 pr-9 rounded-xl border font-sans whitespace-pre-wrap max-h-40 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent",
          isError 
            ? "bg-red-50/50 text-red-700 border-red-150 [&::-webkit-scrollbar-thumb]:bg-red-200" 
            : "bg-slate-50 text-slate-700 border-slate-200 [&::-webkit-scrollbar-thumb]:bg-slate-300"
        )}>
          {rawText}
        </div>
      )}
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 hover:bg-white border border-slate-200 text-slate-500 hover:text-indigo-650 shadow-xs opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer"
        title="Copy to clipboard"
      >
        <Copy className="size-3.5" />
      </button>
    </div>
  );
};

// ----------------------------------------------------
// Premium Admin Observer Workspace (3-column layout)
// ----------------------------------------------------
interface AdminObserverWorkspaceProps {
  threadId: string | null;
  messages: Message[];
  isLoading: boolean;
  stream: any;
  input: string;
  setInput: (val: string) => void;
  handleSubmit: (e: FormEvent) => void;
  showSettings: boolean;
  setShowSettings: (val: boolean) => void;
  isWorkflowOpen: boolean;
  setIsWorkflowOpen: (val: boolean) => void;
  apiUrl: string | null;
  assistantId: string | null;
  authScheme: string | null;
  historyCheckpoints: any[];
  selectedCheckpointId: string | null;
  setSelectedCheckpointId: (val: string | null) => void;
}

export function AdminObserverWorkspace({
  threadId,
  messages,
  isLoading,
  stream,
  input,
  setInput,
  handleSubmit,
  showSettings,
  setShowSettings,
  isWorkflowOpen,
  setIsWorkflowOpen,
  apiUrl,
  assistantId,
  authScheme,
  historyCheckpoints,
  selectedCheckpointId,
  setSelectedCheckpointId
}: AdminObserverWorkspaceProps) {
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

  // Helper to format date safely
  const formatTimeStr = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // 1. Dynamic Extraction of active order ID
  const foundOrderId = useMemo(() => {
    const vals = stream.values || (stream.thread?.values as any) || {};
    if (vals.order_id) return String(vals.order_id).toUpperCase();

    for (const m of messages) {
      const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      const match = text.match(/ORD\d+/i);
      if (match) return match[0].toUpperCase();
    }
    return null;
  }, [messages, stream.values, stream.thread?.values]);

  // Retrieve active order from MOCK_ORDERS
  const activeOrder = useMemo(() => {
    if (!foundOrderId) return null;
    return MOCK_ORDERS[foundOrderId] || null;
  }, [foundOrderId]);

  // Retrieve matching user
  const activeUser = useMemo(() => {
    const vals = stream.values || (stream.thread?.values as any) || {};
    if (vals.user_id && MOCK_USERS[vals.user_id]) {
      return MOCK_USERS[vals.user_id];
    }

    if (!foundOrderId) return null;

    for (const userId of Object.keys(MOCK_USERS)) {
      if (MOCK_USERS[userId].orders.includes(foundOrderId)) {
        return MOCK_USERS[userId];
      }
    }
    return null;
  }, [foundOrderId, stream.values, stream.thread?.values]);

  // Extract artifacts list from current graph thread state values
  const threadArtifacts = useMemo(() => {
    const vals = stream.values || (stream.thread?.values as any) || {};
    let list = (vals.artifacts || []) as any[];

    if (list.length === 0) {
      const dynamicList: any[] = [];
      if (vals.order_id) {
        const orderData = MOCK_ORDERS[vals.order_id] || {
          order_id: vals.order_id,
          status: "delivered",
          total: 299.00,
          date: "01/08/2026",
          items: []
        };
        dynamicList.push({
          id: `dyn-order-${vals.order_id}`,
          type: "order",
          data: orderData
        });
      }
      if (vals.user_id) {
        const userData = MOCK_USERS[vals.user_id] || {
          id: vals.user_id,
          first_name: "Guest",
          last_name: "",
          email: "",
          orders: []
        };
        dynamicList.push({
          id: `dyn-user-${vals.user_id}`,
          type: "user",
          data: userData
        });
      }
      return dynamicList;
    }

    return list;
  }, [stream.values, stream.thread?.values]);

  // 2. Stepper logic
  // Determine if fetch_order tool call occurred
  const hasFetchOrderToolCall = useMemo(() => {
    for (const m of messages) {
      if (m.type === "ai" && m.tool_calls) {
        if (m.tool_calls.some((tc: any) => tc.name === "fetch_order" || tc.name === "get_order" || tc.name === "fetch_user_orders")) {
          return true;
        }
      }
    }
    return false;
  }, [messages]);

  // Check if policy tool was called
  const hasPolicyCheckToolCall = useMemo(() => {
    for (const m of messages) {
      if (m.type === "ai" && m.tool_calls) {
        if (m.tool_calls.some((tc: any) => tc.name === "read_policy" || tc.name === "check_policy")) {
          return true;
        }
      }
    }
    return false;
  }, [messages]);

  // Check if we are at an interrupt
  const isInterrupted = !!stream.interrupt;

  // Confirm / Approval execution trigger
  const handleConfirmAction = () => {
    setInput("");
    stream.submit(
      {
        messages: [
          {
            id: uuidv4(),
            type: "human",
            content: "yes"
          }
        ]
      },
      {
        streamMode: ["values"],
        streamSubgraphs: true,
        streamResumable: true
      }
    );
    toast.success("Đã phê duyệt yêu cầu đổi hàng");
  };

  // Click direct option card trigger
  const handleOptionClick = (optionValue: string) => {
    setInput("");
    stream.submit(
      {
        messages: [
          {
            id: uuidv4(),
            type: "human",
            content: optionValue
          }
        ]
      },
      {
        streamMode: ["values"],
        streamSubgraphs: true,
        streamResumable: true
      }
    );
    toast.info(`${t("sendingResponse")}${optionValue}`);
  };

  const formatPriceVND = (price: number) => {
    if (price < 1000) {
      return (price * 1000).toLocaleString("vi-VN") + "đ";
    }
    return price.toLocaleString("vi-VN") + "đ";
  };

  return (
    <div className="flex flex-col h-screen w-full select-none bg-slate-50 text-slate-800 font-sans admin-theme">
      {/* Top Nav Bar */}
      <div className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push("/admin/sale")}
            className="flex items-center justify-center p-2 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition-all cursor-pointer"
            title={t("backToDashboard")}
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="h-5 w-px bg-slate-250" />
          <div className="flex flex-col text-left">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{t("systemSales")}</span>
            <span className="font-bold text-sm text-slate-800">{t("exchangeDetailsTitle")}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-500">{t("online")}</span>
        </div>
      </div>

      {/* 3-column Layout grid */}
      <div className="grid grid-cols-[32%_40%_28%] w-full h-[calc(100vh-56px)] divide-x divide-slate-200 overflow-hidden">
        
        {/* Column 1: Chat Session */}
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden relative">
          {/* Header */}
          <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex flex-col">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-left">{t("sessionObserver")}</span>
              <span className="font-bold text-sm text-slate-800 text-left">
                {t("workSession")}{threadId ? threadId.substring(0, 7) : "RT-9821"}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 rounded-lg">
              <MoreVertical className="size-4.5" />
            </Button>
          </div>

          {/* Scrollable Messages Area */}
          <div className="flex-grow overflow-y-auto p-4 space-y-4 scrollbar-pretty flex flex-col">
            {messages.length === 0 ? (
              // Mock initial chat session matching mockup
              <div className="flex-grow flex flex-col justify-end space-y-4">
                {/* Human Bubble */}
                <div className="flex flex-col items-end gap-1.5 self-end max-w-[85%]">
                  <div className="bg-blue-600 text-white rounded-2xl rounded-tr-none px-4 py-3 text-xs font-semibold shadow-xs">
                    {t("initialQuestion")}
                  </div>
                  <span className="text-[9px] text-slate-400 font-medium">10:42 AM</span>
                </div>

                {/* AI Bubble */}
                <div className="flex flex-col items-start gap-1.5 self-start max-w-[85%]">
                  <div className="flex items-center gap-1.5 ml-0.5">
                    <span className="h-4 w-4 rounded-full bg-indigo-500 text-[8px] text-white flex items-center justify-center font-black">L</span>
                    <span className="text-[10px] font-bold text-slate-500">Laki AI Assistant</span>
                  </div>
                  <div className="bg-white border border-slate-150 p-4 rounded-2xl rounded-tl-none text-xs text-slate-700 shadow-3xs flex flex-col gap-3">
                    <p className="font-semibold leading-relaxed text-left">
                      {t("initialAiAnswer")}
                    </p>
                    
                    {/* Options cards */}
                    <div className="flex flex-col gap-2 mt-1">
                      <button 
                        onClick={() => handleOptionClick("ORD123")}
                        className="w-full border-2 border-blue-600 bg-blue-50/10 hover:bg-blue-50/20 text-left p-3 rounded-xl flex items-center justify-between transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                            <ClipboardList className="size-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-xs text-slate-800 text-left">{t("optionHoodie")}</span>
                            <span className="text-[10px] text-slate-400 mt-0.5 text-left">{t("optionHoodieDate")}</span>
                          </div>
                        </div>
                        <ArrowRight className="size-4 text-blue-600 transition-transform group-hover:translate-x-0.5" />
                      </button>

                      <button 
                        onClick={() => handleOptionClick("ORD456")}
                        className="w-full border border-slate-150 bg-white hover:bg-slate-50/70 text-left p-3 rounded-xl flex items-center justify-between transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-slate-50 p-2 rounded-lg text-slate-400">
                            <ClipboardList className="size-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-xs text-slate-800 text-left">{t("optionPolo")}</span>
                            <span className="text-[10px] text-slate-400 mt-0.5 text-left">{t("optionPoloDate")}</span>
                          </div>
                        </div>
                        <ArrowRight className="size-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </div>
                  </div>
                  <span className="text-[9px] text-slate-400 font-medium ml-1">10:43 AM</span>
                </div>
              </div>
            ) : (
              // Render real live messages
              messages
                .filter((m) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX))
                .map((m, index) => {
                  const isHuman = m.type === "human";
                  const time = formatTimeStr(new Date());

                  if (isHuman) {
                    return (
                      <div key={m.id || index} className="flex flex-col items-end gap-1.5 self-end max-w-[85%]">
                        <div className="bg-blue-600 text-white rounded-2xl rounded-tr-none px-4 py-2.5 text-xs font-semibold shadow-xs text-left">
                          {typeof m.content === "string" ? m.content : JSON.stringify(m.content)}
                        </div>
                        <span className="text-[9px] text-slate-400 font-medium">{time}</span>
                      </div>
                    );
                  }

                  const textContent = typeof m.content === "string" ? m.content : "";

                  return (
                    <div key={m.id || index} className="flex flex-col items-start gap-1.5 self-start max-w-[85%]">
                      <div className="flex items-center gap-1.5 ml-0.5">
                        <span className="h-4 w-4 rounded-full bg-indigo-500 text-[8px] text-white flex items-center justify-center font-black">L</span>
                        <span className="text-[10px] font-bold text-slate-500">Laki AI Assistant</span>
                      </div>
                      <div className="bg-white border border-slate-150 p-4 rounded-2xl rounded-tl-none text-xs text-slate-700 shadow-3xs flex flex-col gap-3 text-left">
                        <p className="font-semibold leading-relaxed whitespace-pre-wrap">{textContent || "Processing..."}</p>
                        
                        {/* If this is the specific option question, display option buttons */}
                        {textContent.includes("đơn hàng gần đây") && (
                          <div className="flex flex-col gap-2 mt-1">
                            <button 
                              type="button"
                              onClick={() => handleOptionClick("ORD123")}
                              className="w-full border-2 border-blue-600 bg-blue-50/10 hover:bg-blue-50/20 text-left p-3 rounded-xl flex items-center justify-between transition-all group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                                  <ClipboardList className="size-4" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-bold text-xs text-slate-800 text-left">ORD123 - Áo Hoodie</span>
                                  <span className="text-[10px] text-slate-400 mt-0.5 text-left">Giao ngày 01/08/2026</span>
                                </div>
                              </div>
                              <ArrowRight className="size-4 text-blue-600" />
                            </button>

                            <button 
                              type="button"
                              onClick={() => handleOptionClick("ORD456")}
                              className="w-full border border-slate-150 bg-white hover:bg-slate-50/70 text-left p-3 rounded-xl flex items-center justify-between transition-all group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="bg-slate-50 p-2 rounded-lg text-slate-400">
                                  <ClipboardList className="size-4" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-bold text-xs text-slate-800 text-left">ORD456 - Áo Polo</span>
                                  <span className="text-[10px] text-slate-400 mt-0.5 text-left">Giao ngày 15/07/2026</span>
                                </div>
                              </div>
                              <ArrowRight className="size-4 text-slate-400" />
                            </button>
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-400 font-medium ml-1">{time}</span>
                    </div>
                  );
                })
            )}
            
            {isLoading && (
              <div className="flex items-center gap-1.5 self-start bg-white border border-slate-150 px-3 py-2 rounded-full text-[10px] font-bold text-slate-400 shadow-3xs animate-pulse">
                <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-ping" />
                AI is typing...
              </div>
            )}
          </div>

          {/* Bottom input area */}
          <div className="p-4 bg-white border-t border-slate-200 shrink-0">
            <form onSubmit={handleSubmit} className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Nhập tin nhắn hoặc lệnh..."
                className="w-full bg-slate-50 border border-slate-200 pl-4 pr-12 py-3 text-xs rounded-full outline-none focus:bg-white focus:border-blue-500 transition-all font-semibold text-slate-800 placeholder-slate-400"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1.5 h-9 w-9 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center transition-all hover:scale-105 cursor-pointer border-none"
              >
                <Send className="size-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Column 2: AI Reasoning Workflow */}
        <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto p-5 space-y-5">
          {/* Status Badge */}
          <div className="flex justify-center shrink-0">
            <div className="bg-blue-50 text-blue-600 border border-blue-100 rounded-full px-4 py-1.5 text-xs font-bold flex items-center gap-2 shadow-3xs">
              <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
              {t("aiProcessing")}
            </div>
          </div>

          {/* Stepper Timeline Card */}
          <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-2xs text-left relative flex flex-col gap-6">
            {/* Step 1: Intention understood */}
            <div className="flex gap-4 relative z-10">
              <div className="flex flex-col items-center">
                <div className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black shadow-xs shrink-0">
                  ✓
                </div>
                <div className="w-0.5 flex-grow bg-emerald-600/30 mt-2 min-h-10" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-xs text-slate-800">{t("stepperIntention")}</span>
                <span className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  {t("stepperIntentionDesc")}
                </span>
              </div>
            </div>

            {/* Step 2: Retrieve order */}
            <div className="flex gap-4 relative z-10">
              <div className="flex flex-col items-center">
                <div className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black shadow-xs shrink-0">
                  ✓
                </div>
                <div className="w-0.5 flex-grow bg-emerald-600/30 mt-2 min-h-10" />
              </div>
              <div className="flex flex-col gap-0.5 w-full">
                <span className="font-bold text-xs text-slate-800">{t("stepperFindOrder")}</span>
                <span className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  {t("stepperFindOrderDesc")} ({foundOrderId})
                </span>
                {/* Code Block for fetch_order */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 mt-2 flex items-center justify-between text-[10.5px] font-mono text-slate-600 font-medium max-w-xs shadow-3xs">
                  <span>fetch_order('{foundOrderId}')</span>
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    ✓ 200 OK
                  </span>
                </div>
              </div>
            </div>

            {/* Step 3: Check policy */}
            <div className="flex gap-4 relative z-10">
              <div className="flex flex-col items-center">
                <div className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black shadow-xs shrink-0">
                  ✓
                </div>
                <div className="w-0.5 flex-grow bg-slate-200 mt-2 min-h-10" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-xs text-slate-800">{t("stepperPolicy")}</span>
                <span className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  {t("stepperPolicyDesc")}
                </span>
              </div>
            </div>

            {/* Step 4: Check inventory */}
            <div className="flex gap-4 relative z-10">
              <div className="flex flex-col items-center">
                <div className="h-6 w-6 rounded-full border-2 border-blue-600 bg-white text-blue-600 flex items-center justify-center text-xs font-black shadow-xs shrink-0 animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                </div>
                <div className="w-0.5 flex-grow bg-slate-200 mt-2 min-h-10" />
              </div>
              <div className="flex flex-col gap-0.5 w-full">
                <span className="font-bold text-xs text-slate-800">{t("stepperInventory")}</span>
                <span className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  {t("stepperInventoryDesc")}
                </span>
                {/* Skeletons loader */}
                <div className="space-y-2 mt-2 w-48">
                  <div className="h-2.5 bg-slate-100 rounded-full w-full animate-pulse" />
                  <div className="h-2.5 bg-slate-100 rounded-full w-2/3 animate-pulse" />
                </div>
              </div>
            </div>

            {/* Step 5: Final output */}
            <div className="flex gap-4 relative z-10">
              <div className="flex flex-col items-center">
                <div className="h-6 w-6 rounded-full border border-slate-250 bg-slate-100 flex items-center justify-center text-xs font-black shadow-xs shrink-0" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-xs text-slate-400">{t("stepperFinal")}</span>
              </div>
            </div>
          </div>

          {/* Bottom Card: Analysis Result */}
          <div className="bg-white border-2 border-emerald-500 rounded-2xl p-5 shadow-xs text-left relative flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Activity className="size-4" />
                </span>
                <span className="font-black text-xs text-slate-800 uppercase tracking-wider">{t("analyzingResult")}</span>
              </div>
              <span className="bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider select-none">
                {t("readyToExecute")}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <span className="font-bold text-xs text-slate-700 leading-relaxed">
                {t("proposalExchangeSize")}
              </span>

              {/* Checklist items */}
              <div className="flex flex-col gap-2 text-[11px] text-slate-600 font-semibold mt-1">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center text-[9px] font-bold">✓</span>
                  <span>{t("periodReturnOk")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center text-[9px] font-bold">✓</span>
                  <span>{t("categoryExchangeOk")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center text-[9px] font-bold">✓</span>
                  <span>{t("sizeAvailableOk")}</span>
                </div>
              </div>
            </div>

            {/* Action button */}
            <button
              type="button"
              onClick={handleConfirmAction}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-3 px-4 rounded-xl shadow-md hover:scale-101 hover:shadow-lg active:scale-99 transition-all flex items-center justify-center gap-2 cursor-pointer border-none"
            >
              <span>{t("confirmExchange")}</span>
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>

        {/* Column 3: Context Details */}
        <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 shrink-0">
            <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">{t("contextDetails")}</span>
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Real-time</span>
          </div>

          {/* Active Artifacts or Fallbacks */}
          {threadArtifacts && threadArtifacts.length > 0 ? (
            threadArtifacts.map((art: any, index: number) => {
              // Determine if it is order or user
              const isOrder = art.type === "order" || art.order_id || art.data?.order_id;
              const isUser = art.type === "user" || art.email || art.data?.email;

              if (isOrder) {
                const orderData = art.data || art;
                return (
                  <div key={art.id || index} className="bg-white border border-slate-150 rounded-2xl shadow-3xs overflow-hidden text-left flex flex-col">
                    <div className="bg-slate-50/50 px-4 py-3 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 select-none">
                      <span>{t("orderText")} {orderData.order_id}</span>
                      <span className="text-[10px] text-slate-400 font-normal">{orderData.date || "Gần đây"}</span>
                    </div>
                    <div className="flex flex-col divide-y divide-slate-100">
                      {(orderData.items || []).map((item: any, i: number) => (
                        <div key={i} className="p-4 flex gap-3.5 items-center">
                          <div className="h-12 w-10 rounded-xl bg-slate-900 flex items-center justify-center text-white text-lg font-bold shrink-0 shadow-3xs select-none">
                            👕
                          </div>
                          <div className="flex flex-col gap-0.5 min-w-0 text-left">
                            <span className="font-bold text-xs text-slate-800 truncate block">
                              {item.name}
                            </span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block truncate">
                              {Object.entries(item.options || {}).map(([k, v]) => `${k}: ${v}`).join(" | ")}
                            </span>
                            <span className="text-xs font-bold text-blue-600 mt-0.5">
                              {formatPriceVND(item.price)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 pb-4 pt-2 border-t border-slate-100 flex flex-col gap-2.5 text-xs text-slate-600 font-medium">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-400 shrink-0">{t("shippingAddress")}</span>
                        <span className="text-slate-700 text-right font-semibold">
                          {orderData.address ? `${orderData.address.address1 || orderData.address}, ${orderData.address.city || ""}` : (locale === "vi" ? "Chưa có địa chỉ" : "No address")}
                        </span>
                      </div>
                      <div className="flex justify-between items-center font-bold text-slate-800 border-t border-slate-50 pt-2 text-sm">
                        <span>{t("totalAmount")}</span>
                        <span className="text-blue-600">{formatPriceVND(orderData.total || 0)}</span>
                      </div>
                    </div>
                  </div>
                );
              }

              if (isUser) {
                const userData = art.data || art;
                return (
                  <div key={art.id || index} className="bg-white border border-slate-150 rounded-2xl p-4 shadow-3xs text-left flex flex-col gap-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 select-none">
                      <span className="p-1 bg-slate-50 border rounded-lg text-slate-400">
                        <User className="size-4" />
                      </span>
                      <span className="font-bold text-xs text-slate-800">{t("customerInfo")}</span>
                    </div>
                    <div className="flex flex-col gap-3 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-medium">{t("name")}</span>
                        <span className="font-bold text-slate-700">
                          Guest
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-medium">{t("email")}</span>
                        <span className="font-semibold text-slate-700 select-all">{userData.email || "N/A"}</span>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-400 shrink-0 font-medium">{t("address")}</span>
                        <span className="font-semibold text-slate-700 text-right">
                          {userData.address ? `${userData.address.address1 || userData.address}, ${userData.address.city || ""}` : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }

              // Generic Artifact Card
              return (
                <div key={art.id || index} className="bg-white border border-slate-150 rounded-2xl p-4 shadow-3xs text-left flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 select-none">
                    <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">{art.title || art.type || t("contextDetails")}</span>
                    <span className="bg-slate-100 text-slate-500 text-[8px] font-black px-2 py-0.5 rounded-full uppercase">Artifact</span>
                  </div>
                  <pre className="text-[10px] font-mono text-slate-600 bg-slate-50 p-2.5 rounded-xl overflow-x-auto max-h-36 whitespace-pre-wrap leading-normal border border-slate-150">
                    {typeof art.content === "string" ? art.content : JSON.stringify(art.content || art.data || art, null, 2)}
                  </pre>
                </div>
              );
            })
          ) : (
            // Database Fallbacks
            <>
              {/* Active Order Card */}
              {activeOrder && (
                <div className="bg-white border border-slate-150 rounded-2xl shadow-3xs overflow-hidden text-left flex flex-col">
                  {/* Header */}
                  <div className="bg-slate-50/50 px-4 py-3 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 select-none">
                    <span>{t("orderText")} {activeOrder.order_id}</span>
                    <span className="text-[10px] text-slate-400 font-normal">{activeOrder.date}</span>
                  </div>
                  
                  {/* Items List */}
                  <div className="flex flex-col divide-y divide-slate-100">
                    {(activeOrder.items || []).map((item: any, i: number) => (
                      <div key={i} className="p-4 flex gap-3.5 items-center">
                        <div className="h-12 w-10 rounded-xl bg-slate-900 flex items-center justify-center text-white text-lg font-bold shrink-0 shadow-3xs select-none">
                          👕
                        </div>
                        <div className="flex flex-col gap-0.5 min-w-0 text-left">
                          <span className="font-bold text-xs text-slate-800 truncate block">
                            {item.name}
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block truncate">
                            {Object.entries(item.options || {}).map(([k, v]) => `${k}: ${v}`).join(" | ")}
                          </span>
                          <span className="text-xs font-bold text-blue-600 mt-0.5">
                            {formatPriceVND(item.price)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Order Meta details */}
                  <div className="px-4 pb-4 pt-2 border-t border-slate-100 flex flex-col gap-2.5 text-xs text-slate-600 font-medium">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-slate-400 shrink-0">{t("shippingAddress")}</span>
                      <span className="text-slate-700 text-right font-semibold">
                        {activeOrder.address ? `${activeOrder.address.address1}, ${activeOrder.address.city}` : (locale === "vi" ? "Chưa có địa chỉ" : "No address")}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">{t("status")}</span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        activeOrder.status === "delivered" 
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                          : activeOrder.status === "exchange requested" || activeOrder.status === "return requested"
                          ? "bg-violet-50 text-violet-700 border border-violet-100"
                          : "bg-amber-50 text-amber-700 border border-amber-100"
                      }`}>
                        {activeOrder.status === "delivered" 
                          ? t("delivered") 
                          : activeOrder.status === "exchange requested"
                          ? t("exchangeRequest")
                          : activeOrder.status === "return requested"
                          ? t("returnRequest")
                          : activeOrder.status}
                      </span>
                    </div>
                    <div className="flex justify-between items-center font-bold text-slate-800 border-t border-slate-50 pt-2 text-sm">
                      <span>{t("totalAmount")}</span>
                      <span className="text-blue-600">{formatPriceVND(activeOrder.total)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Profile Card */}
              {activeUser && (
                <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-3xs text-left flex flex-col gap-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 select-none">
                    <span className="p-1 bg-slate-50 border rounded-lg text-slate-400">
                      <User className="size-4" />
                    </span>
                    <span className="font-bold text-xs text-slate-800">{t("customerInfo")}</span>
                  </div>

                  <div className="flex flex-col gap-3 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-medium">{t("name")}</span>
                      <span className="font-bold text-slate-700">
                        Guest
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-medium">{t("email")}</span>
                      <span className="font-semibold text-slate-700 select-all">{activeUser.email || "N/A"}</span>
                    </div>

                    <div className="flex justify-between items-start gap-2">
                      <span className="text-slate-400 shrink-0 font-medium">{t("address")}</span>
                      <span className="font-semibold text-slate-700 text-right">
                        {activeUser.address ? `${activeUser.address.address1}, ${activeUser.address.city}` : "N/A"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-medium">{t("payment")}</span>
                      <span className="font-semibold text-slate-700 text-right truncate max-w-[150px]">
                        {activeUser.payment_methods && activeUser.payment_methods.length > 0 
                          ? activeUser.payment_methods.map((pm: any) => `${pm.source.toUpperCase()} (...${pm.last_four || ""})`).join(", ")
                          : (locale === "vi" ? "Chưa có liên kết" : "No link")}
                      </span>
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-50 pt-2">
                      <span className="text-slate-400 font-medium">{t("refundRate")}</span>
                      <span className="font-bold text-emerald-600 flex items-center gap-1">
                        {activeUser.id && activeUser.id.length % 3 === 0 
                          ? `1.8% (${locale === "vi" ? "Rất thấp" : "Very low"})` 
                          : `2.6% (${locale === "vi" ? "Thấp" : "Low"})`}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Empty state placeholder when no order or user is found */}
              {!activeOrder && !activeUser && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2 border border-dashed border-slate-200 rounded-2xl p-6 bg-white shadow-3xs text-center">
                  <Info className="size-8 text-slate-350" />
                  <span className="font-bold text-xs text-slate-500 uppercase tracking-wider">
                    {locale === "vi" ? "Chưa có thông tin bối cảnh" : "No Context Details"}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium leading-relaxed">
                    {locale === "vi" 
                      ? "Bối cảnh sẽ hiển thị khi khách hàng cung cấp mã đơn hàng hoặc thông tin cá nhân." 
                      : "Context details will be loaded here once client provides order or profile details."}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function Thread({ mode }: { mode?: "sale" | "developer" }) {
  const [artifactContext, setArtifactContext] = useArtifactContext();
  const [artifactOpen, closeArtifact] = useArtifactOpen();

  const [threadId, _setThreadId] = useQueryState("threadId");
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(false),
  );
  const [hideToolCalls, setHideToolCalls] = useQueryState(
    "hideToolCalls",
    parseAsBoolean.withDefault(false),
  );
  const [input, setInput] = useState("");
  const [showInterveneConfirm, setShowInterveneConfirm] = useState(false);
  const {
    contentBlocks,
    setContentBlocks,
    handleFileUpload,
    dropRef,
    removeBlock,
    resetBlocks: _resetBlocks,
    dragOver,
    handlePaste,
  } = useFileUpload();
  const [firstTokenReceived, setFirstTokenReceived] = useState(false);
  const [controlTab, setControlTab] = useState<"overview" | "logs" | "history" | "actions">("overview");
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");

  const pathname = usePathname();
  const router = useRouter();
  const isObserverPath = pathname === "/admin" || pathname === "/admin/sale/thread" || pathname === "/admin/thread";

  const [isObserverParam, setIsObserverParam] = useQueryState(
    "observer",
    parseAsBoolean.withDefault(false),
  );

  const isObserver = isObserverPath || isObserverParam;
  const isSaleMode = mode === "sale" || pathname === "/admin/sale/thread";

  const stream = useStreamContext();
  useThreadObserver(isObserver ? threadId : null);
  const messages = stream.messages;
  const isLoading = stream.isLoading;
  const [historyCheckpoints, setHistoryCheckpoints] = useState<any[]>([]);

  const [selectedCheckpointId, setSelectedCheckpointId] = useQueryState("checkpointId");

  useEffect(() => {
    setSelectedCheckpointId(null);
  }, [threadId, setSelectedCheckpointId]);

  const [apiUrl, setApiUrl] = useQueryState("apiUrl");
  const [assistantId, setAssistantId] = useQueryState("assistantId");
  const [authScheme, setAuthScheme] = useQueryState("authScheme");

  const client = useMemo(() => {
    const apiKey = getApiKey();
    return createClient(
      apiUrl || "",
      apiKey ?? undefined,
      authScheme ?? undefined
    );
  }, [apiUrl, authScheme]);

  useEffect(() => {
    if (!threadId || !client) return;
    const fetchHistory = async () => {
      try {
        const res = await client.threads.getHistory(threadId, { limit: 100 });
        setHistoryCheckpoints(res);
      } catch (err) {
        console.error("Failed to fetch thread history inside Thread component:", err);
      }
    };
    fetchHistory();

    let intervalId: any;
    if (isLoading) {
      intervalId = setInterval(fetchHistory, 3000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [threadId, isLoading, client]);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isWorkflowOpen, setIsWorkflowOpen] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const [windowWidth, setWindowWidth] = useState(1200);
  const [expandedToolIds, setExpandedToolIds] = useState<Record<string, boolean>>({});

  const allToolCalls = useMemo(() => {
    const list: {
      id: string;
      name: string;
      args: any;
      response?: any;
      timestamp?: string;
    }[] = [];

    messages.forEach((msg: any) => {
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        msg.tool_calls.forEach((tc: any) => {
          const respMsg = messages.find((m: any) => m.type === "tool" && m.tool_call_id === tc.id);
          list.push({
            id: tc.id,
            name: tc.name,
            args: tc.args,
            response: respMsg ? respMsg.content : undefined,
            timestamp: msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : undefined
          });
        });
      }
    });

    return list.reverse();
  }, [messages]);

  const DEFAULT_RIGHT_PANEL_WIDTH = 400;
  const minChatWidth = useMemo(() => {
    return windowWidth - DEFAULT_RIGHT_PANEL_WIDTH - (chatHistoryOpen ? 300 : 0);
  }, [windowWidth, chatHistoryOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setWindowWidth(window.innerWidth);
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isOverlayMode = true;

  const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > DEFAULT_RIGHT_PANEL_WIDTH && newWidth < window.innerWidth - 80) {
        setRightPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const selectedMessage = useMemo(() => {
    return messages.find((m) => m.id === selectedMessageId);
  }, [messages, selectedMessageId]);

  const [localAssignee, setLocalAssignee] = useState<string | null>(null);

  const extra = (stream.values as any)?.extra;
  const assignee = extra?.assignee || "agent";
  const isActive = (localAssignee || assignee) === "agent";

  useEffect(() => {
    setLocalAssignee(null);
  }, [assignee, threadId]);

  const tokenStats = useMemo(() => {
    let inputTokens = 0;
    let outputTokens = 0;
    let systemTokens = 0;
    let toolTokens = 0;
    let userTokens = 0;
    let historyAiTokens = 0;

    const getContentString = (content: any): string => {
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return content
          .map((c) => {
            if (typeof c === "string") return c;
            if (c && typeof c === "object") {
              return c.text || c.input || JSON.stringify(c);
            }
            return "";
          })
          .join("");
      }
      return content ? JSON.stringify(content) : "";
    };

    messages.forEach((msg, idx) => {
      if (msg.type !== "ai") return;

      let currentInput = 0;
      let currentOutput = 0;
      
      const usage = (msg as any).usage_metadata;
      if (usage) {
        currentInput = usage.input_tokens || usage.prompt_tokens || 0;
        currentOutput = usage.output_tokens || usage.completion_tokens || 0;
      } else {
        const respMeta = (msg as any).response_metadata;
        if (respMeta?.token_usage) {
          currentInput = respMeta.token_usage.prompt_tokens || respMeta.token_usage.input_tokens || 0;
          currentOutput = respMeta.token_usage.completion_tokens || respMeta.token_usage.output_tokens || 0;
        } else {
          const addKwargs = (msg as any).additional_kwargs;
          if (addKwargs?.token_usage) {
            currentInput = addKwargs.token_usage.prompt_tokens || addKwargs.token_usage.input_tokens || 0;
            currentOutput = addKwargs.token_usage.completion_tokens || addKwargs.token_usage.output_tokens || 0;
          }
        }
      }

      inputTokens += currentInput;
      outputTokens += currentOutput;

      if (currentInput > 0) {
        // Find prior messages up to this point in history to calculate proportional length
        const priorMessages = messages.slice(0, idx);
        
        let systemLen = 0;
        let humanLen = 0;
        let toolLen = 0;
        let aiLen = 0;

        priorMessages.forEach((m) => {
          const len = getContentString(m.content).length;
          if (m.type === "system") {
            systemLen += len;
          } else if (m.type === "human") {
            humanLen += len;
          } else if (m.type === "tool") {
            toolLen += len;
          } else if (m.type === "ai") {
            aiLen += len;
          }
        });

        // Default system instructions fallback if not explicitly found in messages
        if (systemLen === 0) {
          systemLen = 1500;
        }

        const totalPriorLen = systemLen + humanLen + toolLen + aiLen || 1;

        systemTokens += Math.round(currentInput * (systemLen / totalPriorLen));
        userTokens += Math.round(currentInput * (humanLen / totalPriorLen));
        toolTokens += Math.round(currentInput * (toolLen / totalPriorLen));
        historyAiTokens += Math.round(currentInput * (aiLen / totalPriorLen));
      }
    });

    // Make sure breakdown categories sum up exactly to inputTokens to prevent rounding discrepancies
    const calculatedSum = systemTokens + userTokens + toolTokens + historyAiTokens;
    const diff = inputTokens - calculatedSum;
    if (diff !== 0 && inputTokens > 0) {
      systemTokens += diff;
    }

    return {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens,
      system: Math.max(0, systemTokens),
      tool: Math.max(0, toolTokens),
      user: Math.max(0, userTokens),
      history: Math.max(0, historyAiTokens),
      completion: outputTokens
    };
  }, [messages]);

  const triggerLogs = useMemo(() => {
    const logs: any[] = [];
    const sortedHistory = [...historyCheckpoints].reverse();

    let runStartTime: number | null = null;
    let nodeStartTime: number | null = null;

    sortedHistory.forEach((checkpointState: any, index) => {
      const checkpointTime = checkpointState.created_at 
        ? new Date(checkpointState.created_at).getTime() 
        : null;
      const timeStr = checkpointState.created_at 
        ? new Date(checkpointState.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : "Active";
      const dateStr = checkpointState.created_at
        ? new Date(checkpointState.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
        : "";
        
      const tasks = checkpointState.tasks || [];
      const writes = checkpointState.metadata?.writes as Record<string, any> || {};
      
      const checkpointId = (typeof checkpointState.checkpoint === "object" 
        ? checkpointState.checkpoint?.checkpoint_id 
        : checkpointState.checkpoint) || index;

      if (checkpointState.parent_checkpoint === null || checkpointState.parent_checkpoint === undefined || index === 0) {
        logs.push({
          id: `log-init-${index}`,
          event: "Session Initialized",
          details: "Agent environment and state channels loaded.",
          timestamp: timeStr,
          date: dateStr,
          type: "system"
        });
        
        logs.push({
          id: `log-status-init-${index}`,
          event: "Agent Status: Idle",
          details: "Awaiting first user prompt.",
          timestamp: timeStr,
          date: dateStr,
          type: "status-idle"
        });
      }

      if (tasks.length > 0) {
        tasks.forEach((task: any, tIdx: number) => {
          const nodeName = task.name || "agent";
          
          if (nodeName.includes("model") || nodeName.includes("agent")) {
            if (runStartTime === null) runStartTime = checkpointTime;
            if (nodeStartTime === null) nodeStartTime = checkpointTime;
            logs.push({
              id: `log-task-${checkpointId}-${tIdx}`,
              event: `LLM Reasoning triggered (${nodeName})`,
              details: "Model inference started to determine next steps.",
              timestamp: timeStr,
              date: dateStr,
              type: "ai"
            });
          } else if (nodeName.includes("tools")) {
            nodeStartTime = checkpointTime;
            logs.push({
              id: `log-task-${checkpointId}-${tIdx}`,
              event: "Tools Execution Node triggered",
              details: "Running requested tool calls in parallel environment.",
              timestamp: timeStr,
              date: dateStr,
              type: "tool"
            });
            logs.push({
              id: `log-status-toolrun-${checkpointId}-${tIdx}`,
              event: "Agent Status: Running (Executing Tools)",
              details: "Running backend tool tasks.",
              timestamp: timeStr,
              date: dateStr,
              type: "status-running"
            });
          }
        });
      }
      
      const parentCp = sortedHistory.find(
        (c) => c.checkpoint?.checkpoint_id === checkpointState.parent_checkpoint?.checkpoint_id || c.checkpoint === checkpointState.parent_checkpoint
      );
      
      const parentMsgIds = new Set(
        (parentCp?.values?.messages || []).map((m: any) => m.id).filter(Boolean)
      );
      
      const currentMessages = checkpointState.values?.messages || [];
      const newMessages = currentMessages.filter(
        (m: any) => m && m.id && !parentMsgIds.has(m.id)
      );

      newMessages.forEach((msg: any, mIdx: number) => {
        if (msg.type === "human") {
          runStartTime = checkpointTime;
          nodeStartTime = checkpointTime;
          logs.push({
            id: `log-write-human-${checkpointId}-${mIdx}`,
            event: "User input received",
            details: `Message: "${msg.content ? (typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)) : ''}"`,
            timestamp: timeStr,
            date: dateStr,
            type: "human"
          });
          logs.push({
            id: `log-status-humanrun-${checkpointId}-${mIdx}`,
            event: "Agent Status: Running",
            details: "Agent execution triggered by user input.",
            timestamp: timeStr,
            date: dateStr,
            type: "status-running"
          });
        } else if (msg.type === "tool") {
          const toolDuration = (nodeStartTime && checkpointTime) ? ((checkpointTime - nodeStartTime) / 1000).toFixed(2) : null;
          const detailsText = toolDuration 
            ? `State updated with tool outputs. Tool execution completed in ${toolDuration}s.` 
            : "State updated with tool outputs, triggering LLM decision loop.";
          
          logs.push({
            id: `log-write-tool-${checkpointId}-${mIdx}`,
            event: `Tool result returned: [${msg.name || "tool"}]`,
            details: detailsText,
            timestamp: timeStr,
            date: dateStr,
            type: "tool"
          });
          nodeStartTime = checkpointTime;
        } else if (msg.type === "ai") {
          const toolCalls = msg.tool_calls || [];
          if (toolCalls.length > 0) {
            const llmDuration = (nodeStartTime && checkpointTime) ? ((checkpointTime - nodeStartTime) / 1000).toFixed(2) : null;
            const detailsText = llmDuration 
              ? `LLM requested tool execution. Reasoning cycle took ${llmDuration}s.` 
              : `Tools: ${toolCalls.map((tc: any) => tc.name).join(", ")}`;
            
            logs.push({
              id: `log-write-ai-tool-${checkpointId}-${mIdx}`,
              event: "LLM requested tool execution",
              details: detailsText,
              timestamp: timeStr,
              date: dateStr,
              type: "ai"
            });
            nodeStartTime = checkpointTime;
          } else {
            const llmDuration = (nodeStartTime && checkpointTime) ? ((checkpointTime - nodeStartTime) / 1000).toFixed(2) : null;
            const llmDetails = llmDuration 
              ? `LLM reasoning finished in ${llmDuration}s. Returning response text.` 
              : "LLM finished execution, returning response text to user.";
            
            logs.push({
              id: `log-write-ai-response-${checkpointId}-${mIdx}`,
              event: "LLM output final response",
              details: llmDetails,
              timestamp: timeStr,
              date: dateStr,
              type: "ai"
            });

            const totalDuration = (runStartTime && checkpointTime) ? ((checkpointTime - runStartTime) / 1000).toFixed(2) : null;
            const runDetails = totalDuration 
              ? `Execution cycle completed successfully in ${totalDuration}s.` 
              : "Execution cycle completed. Final response delivered.";

            logs.push({
              id: `log-status-aiidle-${checkpointId}-${mIdx}`,
              event: "Agent Status: Idle",
              details: runDetails,
              timestamp: timeStr,
              date: dateStr,
              type: "status-idle"
            });

            runStartTime = null;
            nodeStartTime = null;
          }
        }
      });
    });

    const hasInterrupt = (stream as any).thread?.interrupts?.length > 0;
    if (hasInterrupt) {
      logs.push({
        id: "log-interrupt",
        event: "Interruption Active",
        details: "Awaiting human-in-the-loop approval or confirmation to resume.",
        timestamp: "Pending",
        date: "",
        type: "interrupt"
      });
      
      const lastCp = sortedHistory[sortedHistory.length - 1];
      const lastCpTime = lastCp?.created_at ? new Date(lastCp.created_at).getTime() : null;
      const totalDuration = (runStartTime && lastCpTime) ? ((lastCpTime - runStartTime) / 1000).toFixed(2) : null;
      const runDetails = totalDuration 
        ? `Execution cycle paused at ${totalDuration}s. Awaiting manual intervention.` 
        : "Execution paused. Awaiting human intervention.";

      logs.push({
        id: "log-status-interrupt-idle",
        event: "Agent Status: Idle (Interrupted)",
        details: runDetails,
        timestamp: "Pending",
        date: "",
        type: "status-idle"
      });
    }

    if (isLoading) {
      logs.push({
        id: "log-status-current",
        event: "Agent Status: Running",
        details: "LLM reasoning active, processing graph state...",
        timestamp: "Active",
        date: "",
        type: "status-running"
      });
    } else {
      logs.push({
        id: "log-status-current",
        event: "Agent Status: Idle",
        details: "Awaiting next user prompt or action.",
        timestamp: "Active",
        date: "",
        type: "status-idle"
      });
    }

    return logs.reverse();
  }, [historyCheckpoints, (stream as any).thread, isLoading]);

  const handleToggleActive = async (checked: boolean) => {
    if (!threadId) return;
    const newAssignee = checked ? "agent" : "human";
    setLocalAssignee(newAssignee);
    try {
      await stream.client.threads.updateState(threadId, {
        values: {
          extra: {
            ...extra,
            assignee: newAssignee,
            active: checked,
          },
        },
      });
      toast.success(`Agent status updated to ${newAssignee === "agent" ? "Active" : "Inactive (Human Support)"}`);
    } catch (err: any) {
      console.error("[Header] Failed to toggle agent active status:", err);
      toast.error("Failed to update active status");
      setLocalAssignee(assignee);
    }
  };


  const lastError = useRef<string | undefined>(undefined);

  const setThreadId = (id: string | null) => {
    _setThreadId(id);

    // close artifact and reset artifact context
    closeArtifact();
    setArtifactContext({});
  };

  useEffect(() => {
    if (!stream.error) {
      lastError.current = undefined;
      return;
    }
    try {
      const message = (stream.error as any).message;
      if (!message || lastError.current === message) {
        // Message has already been logged. do not modify ref, return early.
        return;
      }

      // Message is defined, and it has not been logged yet. Save it, and send the error
      lastError.current = message;
      toast.error("An error occurred. Please try again.", {
        description: (
          <p>
            <strong>Error:</strong> <code>{message}</code>
          </p>
        ),
        richColors: true,
        closeButton: true,
      });
    } catch {
      // no-op
    }
  }, [stream.error]);

  // TODO: this should be part of the useStream hook
  const prevMessageLength = useRef(0);
  useEffect(() => {
    if (
      messages.length !== prevMessageLength.current &&
      messages?.length &&
      messages[messages.length - 1].type === "ai"
    ) {
      setFirstTokenReceived(true);
    }

    prevMessageLength.current = messages.length;
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if ((input.trim().length === 0 && contentBlocks.length === 0) || isLoading)
      return;
    setFirstTokenReceived(false);

    const newHumanMessage: Message = {
      id: uuidv4(),
      type: "human",
      content: [
        ...(input.trim().length > 0 ? [{ type: "text", text: input }] : []),
        ...contentBlocks,
      ] as Message["content"],
    };

    const toolMessages = ensureToolCallsHaveResponses(stream.messages);

    const context =
      Object.keys(artifactContext).length > 0 ? artifactContext : undefined;

    stream.submit(
      { messages: [...toolMessages, newHumanMessage], context },
      {
        streamMode: ["values"],
        streamSubgraphs: true,
        streamResumable: true,
        optimisticValues: (prev) => ({
          ...prev,
          context,
          messages: [
            ...(prev.messages ?? []),
            ...toolMessages,
            newHumanMessage,
          ],
        }),
      },
    );

    setInput("");
    setContentBlocks([]);
  };

  const handleRegenerate = (
    parentCheckpoint: Checkpoint | null | undefined,
  ) => {
    // Do this so the loading state is correct
    prevMessageLength.current = prevMessageLength.current - 1;
    setFirstTokenReceived(false);
    stream.submit(undefined, {
      checkpoint: parentCheckpoint,
      streamMode: ["values"],
      streamSubgraphs: true,
      streamResumable: true,
    });
  };

  const chatStarted = !!threadId || !!messages.length;
  const hasNoAIOrToolMessages = !messages.find(
    (m) => m.type === "ai" || m.type === "tool",
  );

  if (isSaleMode) {
    return (
      <AdminObserverWorkspace
        threadId={threadId}
        messages={messages}
        isLoading={isLoading}
        stream={stream}
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        isWorkflowOpen={isWorkflowOpen}
        setIsWorkflowOpen={setIsWorkflowOpen}
        apiUrl={apiUrl}
        assistantId={assistantId}
        authScheme={authScheme}
        historyCheckpoints={historyCheckpoints}
        selectedCheckpointId={selectedCheckpointId}
        setSelectedCheckpointId={setSelectedCheckpointId}
      />
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <div className="relative hidden lg:flex">
        <motion.div
          className="absolute z-20 h-full overflow-hidden border-r bg-white"
          style={{ width: 300 }}
          animate={
            isLargeScreen
              ? { x: chatHistoryOpen ? 0 : -300 }
              : { x: chatHistoryOpen ? 0 : -300 }
          }
          initial={{ x: -300 }}
          transition={
            isLargeScreen
              ? { type: "spring", stiffness: 300, damping: 30 }
              : { duration: 0 }
          }
        >
          <div
            className="relative h-full"
            style={{ width: 300 }}
          >
            <ThreadHistory />
          </div>
        </motion.div>
      </div>

      <div
        className="grid w-full h-full relative"
        style={{ gridTemplateColumns: isOverlayMode ? `${minChatWidth}px auto 0px` : `1fr auto ${rightPanelWidth}px` }}
      >
        <motion.div
          className={cn(
            "relative flex min-w-0 flex-col overflow-hidden h-full border-r",
            !chatStarted && "grid-rows-[1fr]",
          )}
          layout={isLargeScreen}
          animate={{
            marginLeft: chatHistoryOpen ? (isLargeScreen ? 300 : 0) : 0,
          }}
          transition={
            isLargeScreen
              ? { type: "spring", stiffness: 300, damping: 30 }
              : { duration: 0 }
          }
        >
          {!chatStarted && (
            <div className="absolute top-0 left-0 z-10 flex w-full items-center justify-between gap-3 p-2 pl-4">
              <div>
                {(!chatHistoryOpen || !isLargeScreen) && (
                  <Button
                    className="hover:bg-gray-100"
                    variant="ghost"
                    onClick={() => setChatHistoryOpen((p) => !p)}
                  >
                    {chatHistoryOpen ? (
                      <PanelRightOpen className="size-5" />
                    ) : (
                      <PanelRightClose className="size-5" />
                    )}
                  </Button>
                )}
              </div>
              <div className="absolute top-2 right-4 flex items-center">
                <OpenGitHubRepo />
              </div>
            </div>
          )}
          {chatStarted && (
            <div className={cn(
              "relative z-10 flex items-center justify-between gap-3 p-2",
              isObserver && "border-b border-gray-150 bg-white px-6 py-4 shadow-sm"
            )}>
              <div className="relative flex items-center justify-start gap-2">
                <div className={cn("absolute left-0 z-10", isObserver && "static flex items-center")}>
                  {(!chatHistoryOpen || !isLargeScreen) && (
                    <Button
                      className="hover:bg-gray-100"
                      variant="ghost"
                      onClick={() => setChatHistoryOpen((p) => !p)}
                    >
                      {chatHistoryOpen ? (
                        <PanelRightOpen className="size-5" />
                      ) : (
                        <PanelRightClose className="size-5" />
                      )}
                    </Button>
                  )}
                </div>
                {isObserver ? (
                  <div className="flex items-center gap-4 ml-1">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase leading-none">
                        Agent Identity
                      </span>
                      <span className="text-base font-bold text-gray-800 mt-1.5 leading-none">
                        {assistantId || "react_agent"}
                      </span>
                    </div>
                    
                    <div className="h-8 w-px bg-gray-200" />
                    
                    <div className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50/50 px-3 py-1 text-xs font-semibold text-gray-700">
                      <span className={cn("h-2 w-2 rounded-full", isLoading ? "bg-emerald-500 animate-pulse" : "bg-gray-400")} />
                      {isLoading ? "Running" : "Idle"}
                    </div>

                    {threadId && (
                      <>
                        <div className="h-8 w-px bg-gray-200" />
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full font-mono select-none">
                          <span className="font-semibold text-gray-700 select-all">{threadId}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(threadId);
                              toast.success("Thread ID copied to clipboard");
                            }}
                            className="text-gray-400 hover:text-indigo-600 transition-colors p-0.5 rounded hover:bg-slate-200/50"
                            title="Copy Thread ID"
                          >
                            <Copy className="size-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <motion.button
                    className="flex cursor-pointer items-center gap-2"
                    onClick={() => setThreadId(null)}
                    animate={{
                      marginLeft: !chatHistoryOpen ? 48 : 0,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                    }}
                  >
                    <LangGraphLogoSVG
                      width={32}
                      height={32}
                    />
                    <span className="text-xl font-semibold tracking-tight">
                      Agent Chat
                    </span>
                  </motion.button>
                )}
              </div>

              <div className="flex items-center gap-4">
                {isObserver ? (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-gray-600">Hide Tool Calls</span>
                      <Switch
                        id="render-tool-calls-header"
                        checked={hideToolCalls ?? false}
                        onCheckedChange={setHideToolCalls}
                      />
                    </div>
                    
                    <TooltipIconButton
                      size="lg"
                      className="p-2 text-gray-600 hover:text-gray-900"
                      tooltip="Connection Settings"
                      variant="ghost"
                      onClick={() => setShowSettings(true)}
                    >
                      <Settings className="size-5" />
                    </TooltipIconButton>
                  </>
                ) : (
                  <>
                    <div className="flex items-center">
                      <OpenGitHubRepo />
                    </div>
                    <TooltipIconButton
                      size="lg"
                      className="p-4"
                      tooltip="New thread"
                      variant="ghost"
                      onClick={() => setThreadId(null)}
                    >
                      <SquarePen className="size-5" />
                    </TooltipIconButton>
                  </>
                )}
              </div>

              <div className="from-background to-background/0 absolute inset-x-0 top-full h-5 bg-gradient-to-b" />
            </div>
          )}

          <StickToBottom className="relative flex-1 overflow-hidden">
            <StickyToBottomContent
              className={cn(
                "absolute inset-0 overflow-y-scroll px-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent",
                !chatStarted && "mt-[25vh] flex flex-col items-stretch",
                chatStarted && "grid grid-rows-[1fr_auto]",
              )}
              contentClassName="pt-8 pb-16 max-w-3xl mx-auto flex flex-col gap-4 w-full"
              content={
                <>
                  {messages
                    .filter((m) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX))
                    .map((message, index) =>
                      message.type === "human" ? (
                        <HumanMessage
                          key={message.id || `${message.type}-${index}`}
                          message={message}
                          isLoading={isLoading}
                        />
                      ) : (
                        <AssistantMessage
                          key={message.id || `${message.type}-${index}`}
                          message={message}
                          isLoading={isLoading}
                          handleRegenerate={handleRegenerate}
                          isSelected={selectedMessageId === message.id}
                          onSelect={() => setSelectedMessageId(message.id === selectedMessageId ? null : (message.id || null))}
                        />
                      ),
                    )}
                  {hasNoAIOrToolMessages && !!stream.interrupt && (
                    <AssistantMessage
                      key="interrupt-msg"
                      message={undefined}
                      isLoading={isLoading}
                      handleRegenerate={handleRegenerate}
                    />
                  )}
                  {isLoading && !firstTokenReceived && (
                    <AssistantMessageLoading />
                  )}
                </>
              }
              footer={
                <div className="sticky bottom-0 flex flex-col items-center gap-8 bg-transparent">
                  {!chatStarted && (
                    <div className="flex items-center gap-3">
                      <LangGraphLogoSVG className="h-8 flex-shrink-0" />
                      <h1 className="text-2xl font-semibold tracking-tight">
                        Agent Chat
                      </h1>
                    </div>
                  )}

                  <ScrollToBottom className="animate-in fade-in-0 zoom-in-95 absolute bottom-full left-1/2 mb-4 -translate-x-1/2" />

                  {isObserver ? (
                    <div className="w-full max-w-2xl px-4 pb-4">
                      <div className="flex flex-col gap-3 rounded-2xl border bg-slate-100/70 p-4 text-center shadow-sm">
                        <div className="flex flex-col gap-1 items-center">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Observer Mode Active
                          </span>
                          <p className="text-xs text-slate-500 max-w-md mt-1">
                            Observing agent live. Intervene to take control.
                          </p>
                        </div>
                        <div className="flex justify-center mt-1">
                          <Button
                            onClick={() => setShowInterveneConfirm(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs py-2 px-5 shadow-md transition-all hover:scale-105"
                          >
                            Intervene & Take Control
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full max-w-2xl px-4 pb-4">
                      <form
                        onSubmit={handleSubmit}
                        className="relative flex flex-col rounded-3xl border bg-white focus-within:ring-2 focus-within:ring-indigo-600/10 focus-within:border-indigo-600 shadow-sm transition-all p-2"
                      >
                        <textarea
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onPaste={handlePaste}
                          onKeyDown={(e) => {
                            if (
                              e.key === "Enter" &&
                              !e.shiftKey &&
                              !e.metaKey &&
                              !e.nativeEvent.isComposing
                            ) {
                              e.preventDefault();
                              const el = e.target as HTMLElement | undefined;
                              const form = el?.closest("form");
                              form?.requestSubmit();
                            }
                          }}
                          placeholder="Type your message..."
                          className="field-sizing-content resize-none border-none bg-transparent p-3.5 pb-0 shadow-none ring-0 outline-none focus:ring-0 focus:outline-none"
                        />

                        <div className="flex items-center gap-6 p-2 pt-4">
                          <Label
                            htmlFor="file-input"
                            className="flex cursor-pointer items-center gap-2"
                          >
                            <Plus className="size-5 text-gray-600" />
                            <span className="text-sm text-gray-600">
                              Upload PDF or Image
                            </span>
                          </Label>
                          <input
                            id="file-input"
                            type="file"
                            onChange={handleFileUpload}
                            multiple
                            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                            className="hidden"
                          />
                          {stream.isLoading ? (
                            <Button
                              key="stop"
                              onClick={() => stream.stop()}
                              className="ml-auto"
                            >
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                              Cancel
                            </Button>
                          ) : (
                            <Button
                              type="submit"
                              className="ml-auto shadow-md transition-all"
                              disabled={
                                isLoading ||
                                (!input.trim() && contentBlocks.length === 0)
                              }
                            >
                              Send
                            </Button>
                          )}
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              }
            />
          </StickToBottom>
        </motion.div>

        {/* Resizable Divider Handle */}
        <div
          onMouseDown={startResizing}
          style={isOverlayMode ? {
            position: "absolute",
            right: `${rightPanelWidth}px`,
            top: 0,
            bottom: 0,
            height: "100%",
            zIndex: 41
          } : undefined}
          className={cn(
            "w-2 h-full cursor-col-resize hover:bg-indigo-600/10 active:bg-indigo-600/30 transition-colors z-30 select-none border-l border-slate-200 bg-transparent",
            isResizing && "bg-indigo-600/20"
          )}
        />

        {/* Right Functional Panel */}
        <div 
          style={isOverlayMode ? {
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: `${rightPanelWidth}px`,
            height: "100%",
            zIndex: 40,
            boxShadow: "-10px 0 30px rgba(0, 0, 0, 0.15)"
          } : undefined}
          className="flex flex-col h-full overflow-hidden select-none bg-slate-50 w-full relative"
        >
          {artifactOpen ? (
            <div className="absolute inset-0 flex flex-col bg-white">
              <div className="grid grid-cols-[1fr_auto] border-b p-4">
                <ArtifactTitle className="truncate overflow-hidden font-bold text-slate-800" />
                <button
                  onClick={closeArtifact}
                  className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <XIcon className="size-5" />
                </button>
              </div>
              <ArtifactContent className="relative flex-grow" />
            </div>
          ) : (
            <div className="flex flex-col h-full overflow-hidden bg-slate-50">
              {/* Header */}
              <div className="bg-white border-b border-slate-200 px-4 py-3.5 flex items-center justify-between">
                <span className="font-bold text-slate-800 text-sm">Control Center</span>
                <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 rounded-full px-2.5 py-0.5 text-[10px] font-semibold border border-indigo-100">
                  ACTIVE
                </div>
              </div>

              {/* Tab Switcher */}
              <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-2 select-none shrink-0">
                <button
                  type="button"
                  onClick={() => setControlTab("overview")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200",
                    controlTab === "overview" 
                      ? "bg-slate-800 text-white shadow-sm" 
                      : "text-slate-650 hover:bg-slate-100"
                  )}
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setControlTab("logs")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200",
                    controlTab === "logs" 
                      ? "bg-slate-800 text-white shadow-sm" 
                      : "text-slate-650 hover:bg-slate-100"
                  )}
                >
                  Logs
                </button>
                <button
                  type="button"
                  onClick={() => setControlTab("history")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200",
                    controlTab === "history" 
                      ? "bg-slate-800 text-white shadow-sm" 
                      : "text-slate-650 hover:bg-slate-100"
                  )}
                >
                  History
                </button>
                <button
                  type="button"
                  onClick={() => setControlTab("actions")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200",
                    controlTab === "actions" 
                      ? "bg-slate-800 text-white shadow-sm" 
                      : "text-slate-655 hover:bg-slate-100"
                  )}
                >
                  Actions
                </button>
              </div>

              {/* Body */}
              <div className="flex-grow p-5 flex flex-col gap-5 overflow-y-auto">
                {controlTab === "overview" ? (
                  <>
                    {/* Agent Flow Toggle Card */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col gap-3 text-left">
                      <div className="flex items-center gap-2">
                        <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
                          <Network className="size-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-slate-800">Agent Flow</h4>
                          <p className="text-[10px] text-slate-500 font-normal">View graph flowchart and execution history</p>
                        </div>
                      </div>
                      
                      <Button
                        type="button"
                        className="w-full mt-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs py-2 shadow-sm flex items-center justify-center gap-2 transition-all hover:scale-102 border-none outline-none"
                        onClick={() => setIsWorkflowOpen(true)}
                      >
                        <PanelRightOpen className="size-3.5" />
                        Open Agent Flow
                      </Button>
                    </div>

                    {/* Agent Control Panel */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col gap-3 text-left">
                      <h5 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Agent Control</h5>
                      
                      <div className="flex items-center justify-between text-xs text-slate-600 border-b border-slate-100 pb-3">
                        <span>Active Mode (Auto-run)</span>
                        <Switch
                          id="agent-active-toggle-control"
                          checked={isActive}
                          onCheckedChange={handleToggleActive}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-slate-600 pt-0.5">
                        <span>Agent Identity</span>
                        <span className="font-semibold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60 font-mono text-[10px]">
                          {assistantId || "react_agent"}
                        </span>
                      </div>
                    </div>

                    {/* Token Usage Stats Card */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col gap-3 text-left">
                      <div className="flex items-center gap-2">
                        <div className="bg-amber-50 p-2 rounded-xl text-amber-600">
                          <Cpu className="size-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-slate-800">Token Usage</h4>
                          <p className="text-[10px] text-slate-500 font-normal font-sans">Thread execution token analytics</p>
                        </div>
                      </div>

                      <div className="mt-1 flex flex-col gap-2.5">
                        {/* Total Tokens summary */}
                        <div className="flex justify-between items-baseline border-b border-slate-100 pb-2">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-sans">Total Tokens</span>
                          <span className="text-sm font-extrabold text-slate-800 font-mono">
                            {tokenStats.total.toLocaleString()}
                          </span>
                        </div>

                        {/* Progress bars */}
                        <div className="flex flex-col gap-2 text-xs">
                          {/* Input tokens */}
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between text-[11px] text-slate-655 font-sans">
                              <span>Prompt (Input)</span>
                              <span className="font-mono font-semibold text-slate-700">{tokenStats.input.toLocaleString()}</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                                style={{ width: `${tokenStats.total > 0 ? (tokenStats.input / tokenStats.total) * 100 : 0}%` }}
                              />
                            </div>
                          </div>

                          {/* Output tokens */}
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between text-[11px] text-slate-655 font-sans">
                              <span>Completion (Output)</span>
                              <span className="font-mono font-semibold text-slate-700">{tokenStats.output.toLocaleString()}</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                                style={{ width: `${tokenStats.total > 0 ? (tokenStats.output / tokenStats.total) * 100 : 0}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Detailed Breakdown */}
                        <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 mt-1.5 text-[11px] font-sans">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Token Breakdown</span>
                          <div className="flex justify-between items-center text-slate-650">
                            <span className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                              System Prompt
                            </span>
                            <span className="font-mono font-semibold text-slate-700">{tokenStats.system.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-655">
                            <span className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400/80" />
                              User Messages
                            </span>
                            <span className="font-mono font-semibold text-slate-700">{tokenStats.user.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-655">
                            <span className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                              Tool Results
                            </span>
                            <span className="font-mono font-semibold text-slate-700">{tokenStats.tool.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-655">
                            <span className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                              History Context
                            </span>
                            <span className="font-mono font-semibold text-slate-700">{tokenStats.history.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-655">
                            <span className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Model Completion
                            </span>
                            <span className="font-mono font-semibold text-slate-700">{tokenStats.completion.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : controlTab === "logs" ? (
                  /* Logs Tab View */
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-sans">Trigger History</span>
                      <span className="text-[9px] font-bold text-slate-400 font-sans">Latest first</span>
                    </div>

                    {triggerLogs.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 text-xs font-medium bg-white border border-dashed rounded-2xl">
                        No agent run triggers recorded yet.
                      </div>
                    ) : (
                      <div className="relative border-l border-slate-200 pl-4 ml-2 flex flex-col gap-5">
                        {triggerLogs.map((log) => (
                          <div key={log.id} className="relative text-left">
                            {/* Chronological dot */}
                            <span className={cn(
                              "absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white ring-1 ring-slate-200",
                              log.type === "human" && "bg-indigo-500",
                              log.type === "tool" && "bg-blue-500",
                              log.type === "ai" && "bg-emerald-500",
                              log.type === "system" && "bg-slate-400",
                              log.type === "interrupt" && "bg-amber-500",
                              log.type === "status-running" && "bg-blue-600 animate-pulse",
                              log.type === "status-idle" && "bg-slate-350",
                              log.type === "tool-call-trigger" && "bg-indigo-400"
                            )} />
                            
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className={cn(
                                  "text-[12px] font-bold font-sans leading-tight",
                                  log.type.startsWith("status-") ? "text-slate-800" : "text-slate-655"
                                )}>
                                  {log.event}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">
                                  {log.timestamp}
                                </span>
                              </div>
                              <p className={cn(
                                "text-[12px] font-normal leading-relaxed font-sans break-words border p-2.5 rounded-xl mt-0.5 shadow-3xs",
                                log.type === "status-running" && "bg-blue-50/20 border-blue-100 text-blue-800",
                                log.type === "status-idle" && "bg-slate-100/40 border-slate-200/80 text-slate-600",
                                log.type === "tool-call-trigger" && "bg-slate-50 border-slate-200 text-indigo-700 font-mono text-[11px] whitespace-pre-wrap leading-normal",
                                (log.type !== "status-running" && log.type !== "status-idle" && log.type !== "tool-call-trigger") && "bg-white border-slate-200/60 text-slate-500"
                              )}>
                                {log.details}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : controlTab === "history" ? (
                  /* Thread State History Tab View */
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-sans">Thread State History</span>
                      <span className="text-[9px] font-bold text-slate-400 font-sans">Chronological (newest first)</span>
                    </div>

                    {historyCheckpoints.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 text-xs font-medium bg-white border border-dashed rounded-2xl">
                        No thread checkpoints found.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {historyCheckpoints.map((checkpoint, index) => {
                          const checkpointId = (typeof checkpoint.checkpoint === "object" 
                            ? checkpoint.checkpoint?.checkpoint_id 
                            : checkpoint.checkpoint) || index;
                            
                          const parentId = (typeof checkpoint.parent_checkpoint === "object"
                            ? checkpoint.parent_checkpoint?.checkpoint_id
                            : checkpoint.parent_checkpoint) || null;
                            
                          const timeStr = checkpoint.created_at 
                            ? new Date(checkpoint.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                            : "Active";
                            
                          const tasks = checkpoint.tasks || [];
                          const activeNode = tasks.length > 0 ? tasks[0].name : (parentId === null ? "init" : "__end__");
                          
                          // Find message content in this checkpoint
                          const currentMessages = checkpoint.values?.messages || [];
                          let summary = "";
                          if (currentMessages.length > 0) {
                            const lastMsg = currentMessages[currentMessages.length - 1];
                            summary = typeof lastMsg.content === "string" ? lastMsg.content : JSON.stringify(lastMsg.content);
                          }

                          const latestCp = historyCheckpoints[0];
                          const latestCpId = latestCp 
                            ? ((typeof latestCp.checkpoint === "object" ? latestCp.checkpoint?.checkpoint_id : latestCp.checkpoint) || null)
                            : null;
                          const isActive = checkpointId === (selectedCheckpointId || latestCpId);

                          return (
                            <button
                              key={checkpointId}
                              type="button"
                              onClick={() => {
                                setSelectedCheckpointId(checkpointId);
                                setIsWorkflowOpen(true);
                              }}
                              className={cn(
                                "w-full text-left p-3.5 rounded-2xl border text-xs flex flex-col gap-2",
                                isActive 
                                  ? "bg-slate-800 border-slate-800 text-white shadow-sm" 
                                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                              )}
                            >
                              <div className="flex justify-between items-center w-full">
                                <span className={cn(
                                  "font-bold uppercase tracking-wider text-[11px] font-mono",
                                  isActive ? "text-indigo-300" : "text-slate-400"
                                )}>
                                  Node: {activeNode}
                                </span>
                                <span className={cn(
                                  "text-[11px] font-mono",
                                  isActive ? "text-slate-350" : "text-slate-455"
                                )}>
                                  {timeStr}
                                </span>
                              </div>
                              
                              {summary && (
                                <p className={cn(
                                  "text-[13px] leading-relaxed font-sans line-clamp-2",
                                  isActive ? "text-slate-200" : "text-slate-500"
                                )}>
                                  {summary}
                                </p>
                              )}
                              
                              <div className={cn(
                                "flex justify-between items-center mt-1 pt-1.5 border-t border-dashed w-full text-[11px] font-semibold",
                                isActive ? "border-slate-700 text-slate-300" : "border-slate-100 text-slate-455"
                              )}>
                                <span className="truncate max-w-[150px] font-mono">ID: {checkpointId.slice(0, 8)}...</span>
                                <span>{isActive ? "Current State" : "Inspect State →"}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Actions Tab View */
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-sans">Tool Execution History</span>
                      <span className="text-[9px] font-bold text-slate-400 font-sans">Latest first</span>
                    </div>

                    {allToolCalls.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 text-xs font-medium bg-white border border-dashed rounded-2xl">
                        No tool calls executed in this session.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {allToolCalls.map((tc) => {
                           const isExpanded = !!expandedToolIds[tc.id];
                          const hasResponse = tc.response !== undefined;
                          const isError = hasResponse && typeof tc.response === "string" && tc.response.trim().startsWith("Error:");
                          
                          return (
                            <div 
                              key={tc.id}
                              className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs flex flex-col transition-all hover:border-indigo-200"
                            >
                              <button
                                type="button"
                                onClick={() => setExpandedToolIds(prev => ({ ...prev, [tc.id]: !prev[tc.id] }))}
                                className="w-full text-left p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors cursor-pointer border-none outline-none"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className={cn(
                                    "p-2 rounded-xl flex-shrink-0",
                                    !hasResponse 
                                      ? "bg-amber-50 text-amber-600 animate-pulse" 
                                      : isError 
                                        ? "bg-red-50 text-red-600" 
                                        : "bg-emerald-50 text-emerald-600"
                                  )}>
                                    <Wrench className="size-4" />
                                  </div>                                  <div className="flex flex-col min-w-0">
                                    <span className="font-mono font-bold text-[13px] text-slate-800 truncate">{tc.name}</span>
                                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">{tc.timestamp || "Active"}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className={cn(
                                    "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                                    !hasResponse 
                                      ? "bg-amber-50 text-amber-600 border border-amber-100" 
                                      : isError 
                                        ? "bg-red-50 text-red-650 border border-red-100" 
                                        : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                  )}>
                                    {!hasResponse ? "Running" : isError ? "Error" : "Completed"}
                                  </span>
                                  {isExpanded ? <ChevronUp className="size-3.5 text-slate-400" /> : <ChevronDown className="size-3.5 text-slate-400" />}
                                </div>
                              </button>

                              {isExpanded && (
                                <div className="px-3.5 pb-3.5 border-t border-slate-100 bg-slate-50/30 flex flex-col gap-3 text-left">
                                  <div className="flex flex-col gap-1.5 mt-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Input Arguments</span>
                                    {formatAndHighlightResponse(tc.args, false)}
                                  </div>
                                  <div className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Output Response</span>
                                    {hasResponse ? (
                                      formatAndHighlightResponse(tc.response, isError)
                                    ) : (
                                      <div className="flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 p-3 rounded-xl font-medium shadow-xs">
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                        Awaiting tool response output...
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {showInterveneConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl border animate-in zoom-in-95 duration-200 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="bg-red-50 p-2.5 rounded-full text-red-600 flex-shrink-0">
                <MessageSquare className="size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold text-lg text-gray-900">
                  Intervene Conversation?
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed font-normal text-left">
                  Are you sure you want to take over this conversation? You will leave observer mode and join the chat directly as a user.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-2">
              <Button
                variant="outline"
                onClick={() => setShowInterveneConfirm(false)}
                className="rounded-xl px-4 py-2 text-sm"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setShowInterveneConfirm(false);
                  if (isObserverPath) {
                    router.push(`/?threadId=${threadId ?? ""}`);
                  } else {
                    setIsObserverParam(null);
                  }
                }}
                className="rounded-xl px-4 py-2 text-sm shadow-md transition-all hover:scale-105"
              >
                Yes, Intervene
              </Button>
            </div>
          </div>
        </div>
      )}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl border animate-in zoom-in-95 duration-200 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b pb-3">
              <Settings className="size-5 text-indigo-600" />
              <h3 className="font-bold text-lg text-gray-950">Connection Settings</h3>
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
                if (typeof window !== "undefined") {
                  window.localStorage.setItem("lg:chat:apiKey", newApiKey);
                }

                setShowSettings(false);
                router.refresh();
              }}
              className="flex flex-col gap-4 text-left"
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
                  defaultValue={(typeof window !== "undefined" && window.localStorage.getItem("lg:chat:apiKey")) || ""}
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
      <WorkflowPanel
        isOpen={isWorkflowOpen}
        onClose={() => setIsWorkflowOpen(false)}
        message={messages[messages.length - 1]}
        allMessages={messages}
        isLoading={isLoading}
        streamInterrupt={stream.interrupt}
        selectedCheckpointId={selectedCheckpointId}
      />
      <PlaceholderPanel
        isOpen={!!selectedMessageId}
        onClose={() => setSelectedMessageId(null)}
        message={selectedMessage}
      />
    </div>
  );
}
