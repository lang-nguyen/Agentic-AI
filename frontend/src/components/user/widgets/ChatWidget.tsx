"use client";

import React, { useState, useEffect, useRef } from "react";
import { useStreamContext } from "@/providers/Stream";
import { useThreads } from "@/providers/Thread";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Loader2,
  Copy,
  Headphones,
  Mail,
  MessageCircle,
  Phone,
  Check,
  MessageSquarePlus,
  History,
  User,
  ClipboardList
} from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/features/auth/useAuth";
import { useLocale } from "@/contexts/locale.context";
import { MOCK_ORDERS } from "@/data/mockData";

interface ChatWidgetProps {
  defaultAssistantId?: string;
}

export function ChatWidget({ defaultAssistantId = "guardian_graph" }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [originCoords, setOriginCoords] = useState<{ x: number; y: number } | null>(null);
  const [screenCenter, setScreenCenter] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [threadsList, setThreadsList] = useState<any[]>([]);
  const [isThreadsLoading, setIsThreadsLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "details">("chat");
  const [selectedArtifactMessageId, setSelectedArtifactMessageId] = useState<string | null>(null);

  const { currentUser } = useAuth();
  const { locale, t } = useLocale();
  const stream = useStreamContext();
  const { getThreads, setThreads } = useThreads();
  const threadId = stream.threadId;
  const setThreadId = stream.setThreadId;
  const [assistantId, setAssistantId] = useState<string>(defaultAssistantId);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const messages = stream.messages || [];
  const isLoading = stream.isLoading;
  const extra = (stream.values as any)?.extra || {};
  const assignee = extra.assignee || "agent";
  const isActive = extra.active !== false;

  // Reset mobile tab when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setMobileTab("chat");
    }
  }, [isOpen]);

  // Scroll to bottom when messages, loading state, or open status changes
  useEffect(() => {
    if (isOpen) {
      // Instant baseline scroll on open
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });

      // Secondary scroll once the MacBook scale animation finishes completely
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [messages, isLoading, isOpen]);



  // Fetch thread list when history view is opened
  useEffect(() => {
    if (showHistory && isOpen) {
      setIsThreadsLoading(true);
      getThreads()
        .then(setThreadsList)
        .catch((err) => console.error("Error loading threads:", err))
        .finally(() => setIsThreadsLoading(false));
    }
  }, [showHistory, isOpen, getThreads]);

  const handleThreadSelect = (selectedThreadId: string) => {
    setThreadId(selectedThreadId);
    setShowHistory(false);
  };

  // Focus on input after agent finishes responding or chat modal opens
  useEffect(() => {
    if (!isLoading && isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isOpen]);

  // Dynamically adjust textarea height based on typing lines
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Listen for custom event to programmatically open the chat widget from trigger coordinates
  useEffect(() => {
    const handleOpenChat = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (typeof window !== "undefined") {
        setScreenCenter({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2
        });
      }
      if (customEvent.detail && typeof customEvent.detail.x === "number") {
        setOriginCoords({ x: customEvent.detail.x, y: customEvent.detail.y });
      } else {
        setOriginCoords(null);
      }
      setIsOpen(true);
    };
    window.addEventListener("open-store-chat", handleOpenChat);
    return () => window.removeEventListener("open-store-chat", handleOpenChat);
  }, []);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast.success(`Copied ${label}`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const getMessageText = (message: any): string => {
    if (!message || !message.content) return "";
    if (typeof message.content === "string") return message.content;
    if (Array.isArray(message.content)) {
      return message.content
        .map((block: any) => {
          if (typeof block === "string") return block;
          if (block && typeof block === "object" && block.type === "text") {
            return block.text;
          }
          return "";
        })
        .join("");
    }
    return "";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const newHumanMessage = {
      id: uuidv4(),
      type: "human" as const,
      content: input.trim(),
    };

    const prevMessages = stream.messages || [];

    stream.submit(
      { messages: [...prevMessages, newHumanMessage] },
      {
        streamMode: ["values"],
        streamSubgraphs: true,
        streamResumable: true,
        optimisticValues: (prev) => ({
          ...prev,
          messages: [
            ...(prev.messages ?? []),
            newHumanMessage,
          ],
        }),
      }
    );

    setInput("");
  };

  const handleQuickReply = (text: string) => {
    if (isLoading) return;
    const newHumanMessage = {
      id: uuidv4(),
      type: "human" as const,
      content: text,
    };
    stream.submit(
      { messages: [...(stream.messages || []), newHumanMessage] },
      {
        streamMode: ["values"],
        streamSubgraphs: true,
        streamResumable: true,
        optimisticValues: (prev) => ({
          ...prev,
          messages: [
            ...(prev.messages ?? []),
            newHumanMessage,
          ],
        }),
      }
    );
  };

  const handleResetChat = () => {
    setThreadId(null);
    setSelectedItems({});
    setSelectedArtifactMessageId(null);
    toast.success("New conversation started!");
  };

  const handleToggleAgent = async () => {
    if (!threadId) return;
    const newActive = !isActive;
    const newAssignee = newActive ? "agent" : "human";

    try {
      await stream.client.threads.updateState(threadId, {
        values: {
          extra: {
            ...extra,
            assignee: newAssignee,
            active: newActive,
          },
        },
      });
      toast.success(
        newActive
          ? "AI Assistant auto-reply activated"
          : "Switched to manual mode (Human support)"
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to update Agent status");
    }
  };

  const toggleItemSelect = (itemId: string) => {
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const getAiStatusText = (): string | null => {
    if (!isLoading) return null;

    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.type === "human") {
      return null;
    }

    const lastAiMsg = [...messages]
      .reverse()
      .find((msg: any) => msg.type === "ai" && msg.tool_calls && msg.tool_calls.length > 0);

    if (lastAiMsg && (lastAiMsg as any).tool_calls) {
      const hasToolResponses = (lastAiMsg as any).tool_calls.every((call: any) => {
        return messages.some(
          (msg) => msg.type === "tool" && msg.tool_call_id === call.id
        );
      });

      if (!hasToolResponses) {
        const activeCall = (lastAiMsg as any).tool_calls[0];
        const toolName = activeCall.name;

        switch (toolName) {
          case "get_order":
            return locale === "en" ? "Searching your order details..." : "Đang tìm kiếm thông tin đơn hàng...";
          case "cancel_order":
            return locale === "en" ? "Processing order cancellation request..." : "Đang xử lý yêu cầu hủy đơn hàng...";
          case "change_shipping_address":
            return locale === "en" ? "Updating your shipping address..." : "Đang cập nhật địa chỉ giao hàng...";
          case "request_refund":
            return locale === "en" ? "Processing your refund request..." : "Đang xử lý yêu cầu hoàn tiền...";
          case "request_return":
            return locale === "en" ? "Processing order return request..." : "Đang xử lý yêu cầu trả hàng...";
          case "request_exchange":
            return locale === "en" ? "Processing item exchange request..." : "Đang xử lý yêu cầu đổi hàng...";
          case "list_products":
            return locale === "en" ? "Retrieving products catalog..." : "Đang truy xuất danh sách sản phẩm...";
          default:
            return locale === "en" ? "Processing..." : "Đang xử lý...";
        }
      }
    }

    if (lastMsg && lastMsg.type === "ai" && getMessageText(lastMsg).trim().length > 0) {
      return null;
    }

    return locale === "en" ? "Thinking..." : "Đang suy nghĩ...";
  };

  const computedStatus = getAiStatusText();
  const [smoothStatus, setSmoothStatus] = useState<string | null>(null);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (!computedStatus) {
      setSmoothStatus(null);
      lastUpdateRef.current = 0;
      return;
    }

    const now = Date.now();
    const minDuration = 800;
    const elapsed = now - lastUpdateRef.current;

    if (smoothStatus && smoothStatus !== computedStatus) {
      if (elapsed < minDuration) {
        const timer = setTimeout(() => {
          setSmoothStatus(computedStatus);
          lastUpdateRef.current = Date.now();
        }, minDuration - elapsed);
        return () => clearTimeout(timer);
      }
    }

    setSmoothStatus(computedStatus);
    lastUpdateRef.current = now;
  }, [computedStatus, smoothStatus]);

  // Find the selected message's artifact (if any)
  const selectedMessage = selectedArtifactMessageId
    ? messages.find((msg) => msg.id === selectedArtifactMessageId)
    : null;

  const orderArtifact = (selectedMessage?.additional_kwargs?.artifact as any)?.order;
  const userArtifact = (selectedMessage?.additional_kwargs?.artifact as any)?.user;

  const offsetX = originCoords ? originCoords.x - screenCenter.x : 0;
  const offsetY = originCoords ? originCoords.y - screenCenter.y : 0;
  const hasArtifactToShow = !!selectedArtifactMessageId && (!!orderArtifact || !!userArtifact);

  return (
    <>
      {/* Centered Chat Window Modal Popup */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            {/* Modal Box (MacBook Style Multi-Column Grid Layout) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.01, x: offsetX, y: offsetY }}
              animate={{
                opacity: 1,
                scale: 1,
                x: 0,
                y: 0,
                maxWidth: hasArtifactToShow ? 920 : 500
              }}
              exit={{ opacity: 0, scale: 0.01, x: offsetX, y: offsetY }}
              transition={{
                type: "spring",
                stiffness: 240,
                damping: 28
              }}
              className="relative w-[calc(100vw-32px)] md:w-full h-[calc(100vh-32px)] md:h-[680px] flex flex-col md:flex-row overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl z-10 origin-center"
            >

              {/* LEFT COLUMN: The Chat Conversation Dialog Area (62% width) */}
              <div className={`w-full md:w-[500px] md:max-w-[500px] shrink-0 flex flex-col h-full bg-white ${hasArtifactToShow ? "border-r border-slate-100" : ""} ${hasArtifactToShow && mobileTab === "details" ? "hidden md:flex" : "flex"
                }`}>

                {/* Left Column Header with communicative contact shortcuts */}
                <div className="bg-white border-b border-slate-100 p-4 shrink-0 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="font-extrabold text-slate-850 tracking-tight text-base">
                      {locale === "en" ? "Conversation" : "Cuộc hội thoại"}
                    </h3>
                  </div>

                  {/* Header Reset & Settings controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleResetChat}
                      title={locale === "en" ? "New Chat" : "Cuộc hội thoại mới"}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
                    >
                      <MessageSquarePlus className="size-4" />
                    </button>
                    <button
                      onClick={() => setShowHistory(!showHistory)}
                      title={locale === "en" ? "Chat History" : "Lịch sử trò chuyện"}
                      className={`rounded-lg p-1.5 transition-colors cursor-pointer ${showHistory
                        ? "text-orange-600 bg-orange-50"
                        : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        }`}
                    >
                      <History className="size-4" />
                    </button>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Mobile Toggle Tabs */}
                {hasArtifactToShow && (
                  <div className="flex md:hidden border-b border-slate-100 p-2 shrink-0 bg-slate-50 gap-2 select-none">
                    <button
                      onClick={() => setMobileTab("chat")}
                      className={`flex-1 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer ${mobileTab === "chat"
                        ? "bg-white text-orange-600 shadow-3xs"
                        : "text-slate-550 hover:text-slate-700"
                        }`}
                    >
                      {locale === "en" ? "Chat" : "Trò chuyện"}
                    </button>
                    <button
                      onClick={() => setMobileTab("details")}
                      className={`flex-1 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer ${mobileTab === "details"
                        ? "bg-white text-orange-600 shadow-3xs"
                        : "text-slate-555 hover:text-slate-700"
                        }`}
                    >
                      {locale === "en" ? "Details" : "Chi tiết"}
                    </button>
                  </div>
                )}


                {/* Messages Body conversation thread list OR Chat History List */}
                {showHistory ? (
                  <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 scrollbar-pretty flex flex-col select-none text-left">
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 mb-3">
                      <span className="text-[10px] font-black text-slate-455 uppercase tracking-widest block">
                        {locale === "en" ? "Chat History" : "Lịch sử trò chuyện"}
                      </span>
                      <button
                        onClick={() => setShowHistory(false)}
                        className="text-[10px] font-bold text-orange-600 hover:text-orange-700 cursor-pointer"
                      >
                        {locale === "en" ? "Back to Chat →" : "Quay lại chat →"}
                      </button>
                    </div>

                    {isThreadsLoading ? (
                      <div className="flex flex-col items-center justify-center py-20 space-y-3">
                        <Loader2 className="size-6 text-orange-600 animate-spin" />
                        <span className="text-xs text-slate-400 font-medium">
                          {locale === "en" ? "Loading conversations..." : "Đang tải hội thoại..."}
                        </span>
                      </div>
                    ) : threadsList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-2.5 text-center">
                        <MessageSquare className="size-8 opacity-45 text-slate-400" />
                        <span className="text-xs font-semibold">
                          {locale === "en" ? "No chat history found" : "Không có lịch sử trò chuyện"}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2 overflow-y-auto max-h-[500px] pr-1 scrollbar-pretty">
                        {threadsList.map((t) => {
                          let itemText = t.thread_id;
                          if (
                            typeof t.values === "object" &&
                            t.values &&
                            "messages" in t.values &&
                            Array.isArray(t.values.messages) &&
                            t.values.messages.length > 0
                          ) {
                            const firstMessage = t.values.messages[0];
                            if (typeof firstMessage.content === "string") {
                              itemText = firstMessage.content;
                            } else if (Array.isArray(firstMessage.content)) {
                              itemText = firstMessage.content
                                .map((b: any) => b?.text || "")
                                .join("");
                            }
                          }

                          const isCurrent = t.thread_id === threadId;

                          return (
                            <button
                              key={t.thread_id}
                              onClick={() => handleThreadSelect(t.thread_id)}
                              className={`w-full text-left p-3 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer ${isCurrent
                                ? "bg-orange-50/70 border-orange-200 text-orange-950 font-bold"
                                : "bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50/50"
                                }`}
                            >
                              <MessageCircle className={`size-4.5 mt-0.5 shrink-0 ${isCurrent ? "text-orange-600" : "text-slate-400"}`} />
                              <div className="min-w-0 flex-1 flex items-center">
                                <p className="font-bold text-xs truncate max-w-[240px] leading-snug">{itemText}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-grow flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-slate-50/50 scrollbar-pretty">
                      {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3 select-none">
                          <motion.div
                            animate={{ y: [0, -6, 0] }}
                            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                            className="h-20 w-20 relative select-none shrink-0"
                          >
                            <img
                              src="/taobao_mascot.png"
                              alt="Mascot Welcome"
                              className="h-full w-full object-contain"
                            />
                          </motion.div>
                          <h4 className="font-bold text-sm text-slate-850">
                            {locale === "en" ? "Welcome to Laki Shop!" : "Chào mừng bạn đến với Laki Shop!"}
                          </h4>
                          <p className="text-xs text-slate-500 max-w-xs leading-relaxed font-medium">
                            {locale === "en"
                              ? "I am your Shopping Assistant. I can help you look up orders, update shipping addresses, or process returns."
                              : "Tôi là Trợ lý mua sắm của bạn. Tôi có thể hỗ trợ tra cứu đơn hàng, cập nhật địa chỉ giao hàng, hoặc thực hiện trả hàng."}
                          </p>

                        </div>
                      )}

                      {messages.map((message, index) => {
                        const text = getMessageText(message);

                        if (message.type === "human") {
                          const isLastMsg = index === messages.length - 1;
                          const isSending = isLastMsg && isLoading;

                          return (
                            <div key={`msg-${index}`} className="flex justify-end">
                              <div className="space-y-1 max-w-full text-right flex flex-col items-end">
                                <span className="text-[10px] text-slate-400 font-bold block">
                                  {locale === "en" ? "You" : "Bạn"}
                                </span>
                                <div className="bg-orange-600 text-white rounded-2xl rounded-tr-xs px-3.5 py-2 text-sm text-left inline-block max-w-full shadow-sm break-words">
                                  {text}
                                </div>
                                {isSending && (
                                  <span className="text-[9px] text-slate-400 font-medium animate-pulse mt-1 select-none">
                                    {locale === "en" ? "Sending..." : "Đang gửi..."}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        }

                        if (message.type === "ai") {
                          if (!text && !message.additional_kwargs?.artifact) return null;

                          const artifact = message.additional_kwargs?.artifact as any;
                          const msgOrderArtifact = artifact?.order;

                          return (
                            <div key={`msg-${index}`} className="flex justify-start">
                              <div className="space-y-2.5 max-w-full flex-grow text-left">
                                <span className="text-[10px] text-slate-400 font-bold block">AI Agent</span>
                                {text && (
                                  <div className="bg-white border border-slate-200 text-slate-850 rounded-2xl rounded-tl-xs px-3.5 py-2 text-sm shadow-2xs inline-block max-w-full">
                                    <div className="prose prose-sm max-w-none text-slate-800 leading-relaxed break-words">
                                      <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                          ul: ({ node, ...props }) => <ul className="list-disc pl-5 my-1.5 space-y-0.5 text-slate-800" {...props} />,
                                          ol: ({ node, ...props }) => <ol className="list-decimal pl-5 my-1.5 space-y-0.5 text-slate-800" {...props} />,
                                          li: ({ node, ...props }) => <li className="pl-0.5" {...props} />,
                                          p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                          a: ({ node, ...props }) => <a className="text-orange-600 hover:underline font-bold" target="_blank" rel="noopener noreferrer" {...props} />
                                        }}
                                      >
                                        {text}
                                      </ReactMarkdown>
                                    </div>
                                  </div>
                                )}

                                {/* View Details Toggle Button */}
                                {((message.additional_kwargs?.artifact as any)?.order || (message.additional_kwargs?.artifact as any)?.user) && (() => {
                                  const isSelected = selectedArtifactMessageId === message.id;
                                  return (
                                    <button
                                      onClick={() => setSelectedArtifactMessageId(isSelected ? null : (message.id || null))}
                                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-extrabold transition-all cursor-pointer shadow-3xs w-max mt-1 ${
                                        isSelected
                                          ? "bg-orange-50 border-orange-200 text-orange-700 font-bold"
                                          : "bg-white border-slate-250 hover:border-slate-355 text-slate-700 hover:bg-slate-50"
                                      }`}
                                    >
                                      <ClipboardList className="size-3.5" />
                                      {isSelected
                                        ? (locale === "en" ? "Hide details" : "Ẩn chi tiết")
                                        : (locale === "en" ? "View details" : "Xem chi tiết")
                                      }
                                    </button>
                                  );
                                })()}

                                {/* Render Order Item Card selection widgets exactly like screenshot */}
                                {msgOrderArtifact && (
                                  <div className="space-y-2 mt-2 w-full select-none">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                                      {locale === "en" ? "Ordered items" : "Sản phẩm đã đặt"}
                                    </span>
                                    <div className="flex gap-3 overflow-x-auto px-1 pt-1 pb-2 scrollbar-pretty">
                                      {msgOrderArtifact.items?.map((item: any, itemIdx: number) => {
                                        const isSelected = !!selectedItems[item.item_id];
                                        return (
                                          <div
                                            key={item.item_id || itemIdx}
                                            className={`w-[135px] bg-white border rounded-2xl p-2.5 text-center flex flex-col justify-between shrink-0 space-y-2.5 transition-all ${isSelected ? "border-orange-500 shadow-3xs scale-102" : "border-slate-200 hover:border-slate-300"
                                              }`}
                                          >
                                            {/* Product placeholder image */}
                                            <div className="h-16 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-[8px] font-bold border relative overflow-hidden">
                                              <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:10px_10px]" />
                                              IMAGE
                                            </div>
                                            <div className="text-left space-y-0.5">
                                              <h5 className="font-bold text-[11px] text-slate-800 truncate">{item.name}</h5>
                                              <span className="text-[10px] font-bold text-slate-400 block">${item.price.toFixed(2)}</span>
                                            </div>
                                            <button
                                              onClick={() => toggleItemSelect(item.item_id)}
                                              className={`w-full py-1.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${isSelected
                                                ? "bg-orange-600 text-white border border-orange-600 shadow-sm shadow-orange-600/10"
                                                : "bg-white border border-slate-250 text-slate-700 hover:bg-slate-50"
                                                }`}
                                            >
                                              {isSelected ? "Selected" : "Select"}
                                            </button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                              </div>
                            </div>
                          );
                        }

                        if (message.type === "tool") {
                          return null;
                        }

                        return null;
                      })}

                      {/* Typing Loader & Status */}
                      <AnimatePresence>
                        {isLoading && smoothStatus && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            transition={{ duration: 0.25 }}
                            className="flex justify-start select-none"
                          >
                            <div className="space-y-1.5 text-left max-w-[85%]">
                              <span className="text-[10px] text-slate-400 font-bold block">AI Agent</span>
                              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs px-4 py-2.5 shadow-2xs flex items-center gap-3 w-max">
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                                </div>
                                <div className="h-4 flex items-center overflow-hidden">
                                  <AnimatePresence mode="wait">
                                    <motion.span
                                      key={smoothStatus}
                                      initial={{ opacity: 0, y: 4 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -4 }}
                                      transition={{ duration: 0.2 }}
                                      className="text-[11px] text-slate-500 font-semibold block whitespace-nowrap"
                                    >
                                      {smoothStatus}
                                    </motion.span>
                                  </AnimatePresence>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div ref={messagesEndRef} />
                    </div>



                    {/* Input Text Form Footer */}
                    <form
                      onSubmit={handleSubmit}
                      className="p-3 border-t border-slate-100 bg-white flex items-center gap-2 shrink-0"
                    >
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={
                          assignee === "human"
                            ? "Type a message to the agent..."
                            : "Type your request..."
                        }
                        rows={1}
                        className="flex-1 bg-slate-100 hover:bg-slate-200/70 focus:bg-white border-0 focus:ring-2 focus:ring-orange-500 rounded-2xl px-4 py-2.5 text-xs outline-none transition-[background-color,border-color,ring] placeholder:text-slate-400 text-slate-800 font-medium resize-none overflow-y-auto scrollbar-pretty align-middle min-h-[38px]"
                        disabled={isLoading}
                      />
                      <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="h-9 w-9 flex items-center justify-center rounded-full bg-orange-600 hover:bg-orange-700 text-white disabled:bg-slate-100 disabled:text-slate-400 transition-colors shadow-md shrink-0 cursor-pointer"
                      >
                        <Send className="size-4" />
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: MacBook-style User Summary, Active Order, and Chain of Thought Sidebar (38% width) */}
              <AnimatePresence>
                {hasArtifactToShow && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 420, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 240,
                      damping: 28
                    }}
                    className={`bg-[#f9fafb] md:border-l border-slate-100 flex-col h-full overflow-hidden select-none text-left shrink-0 ${
                      mobileTab === "details" ? "flex w-full" : "hidden md:flex"
                    }`}
                  >
                    <div className="w-[420px] flex flex-col h-full p-5 space-y-4 overflow-y-auto scrollbar-pretty">
                    {/* Section Title */}
                    <div className="border-b border-slate-200/60 pb-3 text-left flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-455 uppercase tracking-widest block">
                        {locale === "en" ? "Detail" : "Chi tiết"}
                      </span>
                      <button
                        onClick={() => setSelectedArtifactMessageId(null)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
                        title={locale === "en" ? "Close details" : "Đóng chi tiết"}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>

                    {orderArtifact ? (
                      /* 1. RENDER ORDER ARTIFACT */
                      <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs space-y-4">
                          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                                {locale === "en" ? "Detail Type" : "Loại chi tiết"}
                              </span>
                              <h4 className="font-mono font-bold text-xs text-slate-800">Order #{orderArtifact.order_id}</h4>
                            </div>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${orderArtifact.status === "delivered"
                              ? "bg-emerald-50 border-emerald-250 text-emerald-700"
                              : orderArtifact.status === "cancelled"
                                ? "bg-rose-50 border-rose-250 text-rose-700"
                                : "bg-amber-50 border-amber-250 text-amber-700"
                              }`}>
                              {orderArtifact.status}
                            </span>
                          </div>

                          <div className="space-y-2">
                            <span className="text-[9px] font-black text-slate-400 block uppercase tracking-widest">Product Details</span>
                            <div className="space-y-2 divide-y divide-slate-50">
                              {orderArtifact.items?.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between text-[11px] pt-2 leading-tight text-slate-655 font-semibold">
                                  <div>
                                    <span className="text-slate-700 block">{item.name}</span>
                                    {item.options && Object.keys(item.options).length > 0 && (
                                      <span className="text-[9px] text-slate-400 font-normal">
                                        {Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(", ")}
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-mono text-slate-455 shrink-0">${item.price.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {orderArtifact.address && (
                            <div className="space-y-1.5 pt-3 border-t border-slate-150/60">
                              <span className="text-[9px] font-black text-slate-400 block uppercase tracking-widest">Shipping Destination</span>
                              <p className="text-[11px] leading-relaxed text-slate-555 font-semibold">
                                {orderArtifact.address.address1}
                                {orderArtifact.address.address2 ? `, ${orderArtifact.address.address2}` : ""}
                                <br />
                                {orderArtifact.address.city}, {orderArtifact.address.state} {orderArtifact.address.zip}
                              </p>
                            </div>
                          )}

                          <div className="flex justify-between items-center pt-3 border-t border-slate-150/60 font-bold text-xs">
                            <span className="text-slate-800">Total Valuation</span>
                            <span className="font-mono text-slate-900">${orderArtifact.total?.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    ) : userArtifact ? (
                      /* 2. RENDER USER ARTIFACT */
                      <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs space-y-4">
                          <div className="pb-2 border-b border-slate-100">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                              {locale === "en" ? "Detail Type" : "Loại chi tiết"}
                            </span>
                            <h4 className="font-bold text-xs text-slate-800">Customer Profile</h4>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <span className="text-[9px] text-slate-400 block uppercase tracking-wider">Full Name</span>
                              <p className="text-xs font-bold text-slate-800">{userArtifact.name || `${userArtifact.first_name} ${userArtifact.last_name}`}</p>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-400 block uppercase tracking-wider">Email Address</span>
                              <p className="text-xs font-semibold text-slate-700 font-mono">{userArtifact.email}</p>
                            </div>

                            {userArtifact.address && (
                              <div className="pt-2.5 border-t border-slate-100">
                                <span className="text-[9px] text-slate-400 block uppercase tracking-wider mb-1">Registered Address</span>
                                <p className="text-[11px] leading-relaxed text-slate-555 font-semibold">
                                  {userArtifact.address.address1}
                                  {userArtifact.address.address2 ? `, ${userArtifact.address.address2}` : ""}
                                  <br />
                                  {userArtifact.address.city}, {userArtifact.address.state} {userArtifact.address.zip}
                                </p>
                              </div>
                            )}

                            {userArtifact.payment_methods && userArtifact.payment_methods.length > 0 && (
                              <div className="pt-2.5 border-t border-slate-100">
                                <span className="text-[9px] text-slate-400 block uppercase tracking-wider mb-1">Saved Payment Channels</span>
                                <div className="space-y-1.5">
                                  {userArtifact.payment_methods.map((pm: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center bg-slate-50 border rounded-lg px-2 py-1 text-[10px] text-slate-600">
                                      <span className="capitalize font-medium">{pm.source.replace("_", " ")}</span>
                                      {pm.last_four && <span className="font-mono text-slate-400">•••• {pm.last_four}</span>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
