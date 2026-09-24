import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Activity, Clock, Play, Pause, Eye, Copy, Check, AlertCircle, RefreshCw, ChevronRight, User, Terminal, Cpu, Wrench, AlertTriangle
} from "lucide-react";
import { useTypedStream } from "@/providers/Stream";
import { createClient } from "@/providers/client";
import { type Message } from "@langchain/langgraph-sdk";
import Link from "next/link";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { getContentString } from "./utils";
import { Button } from "@/components/common/ui/button";

interface MiniThreadMonitorProps {
  threadId: string;
  apiUrl: string;
  assistantId: string;
  authScheme?: string;
  makeAdminLink: (tid: string) => string;
}

export function MiniThreadMonitor({
  threadId,
  apiUrl,
  assistantId,
  authScheme,
  makeAdminLink,
}: MiniThreadMonitorProps) {
  const apiKey = typeof window !== "undefined" ? window.localStorage.getItem("lg:chat:apiKey") : null;
  
  // 1. Initialize stream hook for this thread ID
  const stream = useTypedStream({
    apiUrl,
    apiKey: apiKey ?? undefined,
    assistantId,
    threadId,
    fetchStateHistory: true,
    ...(authScheme && {
      defaultHeaders: {
        "X-Auth-Scheme": authScheme,
      },
    }),
  });

  const [copied, setCopied] = useState(false);
  const [threadState, setThreadState] = useState<any>(null);
  const [activeRun, setActiveRun] = useState<any>(null);
  const [lastRun, setLastRun] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [elapsedTime, setElapsedTime] = useState<number | null>(null);
  const [finalDuration, setFinalDuration] = useState<number | null>(null);
  const [isTogglingActive, setIsTogglingActive] = useState(false);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeRunIdRef = useRef<string | null>(null);

  // Helper to fetch thread state and runs
  const fetchThreadData = async () => {
    if (!stream.client || !threadId) return;
    try {
      const [state, runs] = await Promise.all([
        stream.client.threads.getState(threadId),
        stream.client.runs.list(threadId, { limit: 5 })
      ]);
      
      setThreadState(state);
      
      const active = runs.find(r => r.status === "running" || r.status === "pending");
      const last = runs[0];
      
      setActiveRun(active || null);
      setLastRun(last || null);
    } catch (err) {
      console.error(`[MiniMonitor-${threadId}] Error fetching data:`, err);
    }
  };

  // 2. Poll active runs & handle real-time streaming join
  useEffect(() => {
    if (!threadId || !stream.client) return;

    activeRunIdRef.current = null;

    const checkAndJoinActiveRun = async () => {
      try {
        const runs = await stream.client.runs.list(threadId, { limit: 5 });
        const active = runs.find(r => r.status === "running" || r.status === "pending");
        const last = runs[0];
        
        setActiveRun(active || null);
        setLastRun(last || null);

        if (active && active.run_id !== activeRunIdRef.current && !stream.isLoading) {
          activeRunIdRef.current = active.run_id;
          console.log(`[MiniMonitor-${threadId}] Joining stream for run: ${active.run_id}`);
          await stream.joinStream(active.run_id);
        } else if (!active) {
          activeRunIdRef.current = null;
        }
      } catch (err) {
        console.error(`[MiniMonitor-${threadId}] Polling error:`, err);
      }
    };

    fetchThreadData();
    checkAndJoinActiveRun();

    pollIntervalRef.current = setInterval(checkAndJoinActiveRun, 4000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [threadId, stream.isLoading, stream.client]);

  // Refetch when stream finishes loading (meaning run completed or suspended)
  useEffect(() => {
    if (!stream.isLoading) {
      fetchThreadData();
    }
  }, [stream.isLoading]);

  // Timer logic for active run duration and final run duration
  useEffect(() => {
    const isRunning = activeRun !== null;
    
    if (isRunning && activeRun?.created_at) {
      setFinalDuration(null); // Clear previous final duration
      const startTime = new Date(activeRun.created_at).getTime();
      
      const interval = setInterval(() => {
        const diff = (Date.now() - startTime) / 1000;
        setElapsedTime(diff >= 0 ? diff : 0);
      }, 100);
      
      return () => {
        clearInterval(interval);
      };
    } else {
      setElapsedTime(null);
      
      // Calculate duration of the completed run
      if (lastRun && lastRun.status !== "running" && lastRun.status !== "pending") {
        const duration = (new Date(lastRun.updated_at).getTime() - new Date(lastRun.created_at).getTime()) / 1000;
        setFinalDuration(duration >= 0 ? duration : 0);
      }
    }
  }, [activeRun, lastRun]);

  const handleCopy = () => {
    navigator.clipboard.writeText(threadId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Thread ID copied to clipboard");
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchThreadData();
    setIsRefreshing(false);
    toast.success("State refreshed");
  };

  const handleInterrupt = async () => {
    if (!activeRun || !stream.client) return;
    try {
      await stream.client.runs.cancel(threadId, activeRun.run_id);
      toast.success("Agent execution interrupted");
      fetchThreadData();
    } catch (err: any) {
      toast.error("Failed to interrupt agent: " + (err.message || err));
    }
  };

  const handleToggleActive = async () => {
    if (!stream.client) return;

    if (status === "RUNNING") {
      if (!activeRun) return;
      try {
        await stream.client.runs.cancel(threadId, activeRun.run_id);
        toast.success("Agent execution paused");
        fetchThreadData();
      } catch (err: any) {
        toast.error("Failed to pause agent: " + (err.message || err));
      }
    } else {
      try {
        toast.info("Resuming agent execution...");
        await stream.client.runs.create(threadId, assistantId, {
          input: null
        });
        toast.success("Agent started running");
        fetchThreadData();
      } catch (err: any) {
        toast.error("Failed to start agent: " + (err.message || err));
      }
    }
  };

  const isActive = threadState?.values?.extra?.active !== false;

  const handleToggleAutoRun = async () => {
    if (!stream.client || !threadId) return;
    setIsTogglingActive(true);
    try {
      const currentExtra = threadState?.values?.extra || {};
      const newActive = !isActive;
      await stream.client.threads.updateState(threadId, {
        values: {
          extra: {
            ...currentExtra,
            active: newActive,
            assignee: newActive ? "agent" : "human"
          }
        }
      });
      toast.success(newActive ? "Auto-run enabled" : "Auto-run disabled");
      await fetchThreadData();
    } catch (err: any) {
      toast.error("Failed to toggle Auto-run: " + (err.message || err));
    } finally {
      setIsTogglingActive(false);
    }
  };

  // Determine current status
  const status = useMemo(() => {
    if (activeRun || stream.isLoading) return "RUNNING";
    
    // Check if next executes human node (waiting for HITL approval)
    const isWaitingForHuman = 
      (threadState?.next && threadState.next.includes("human")) ||
      (threadState?.values?.extra?.assignee === "human");
      
    if (isWaitingForHuman) return "WAITING_HITL";
    if (lastRun?.status === "error") return "ERROR";
    
    return "IDLE";
  }, [activeRun, stream.isLoading, threadState, lastRun]);

  // Extract recent messages
  const messages = stream.values?.messages || [];
  const recentMessages = useMemo(() => {
    return messages.slice(-5); // Show last 5 messages for brevity
  }, [messages]);

  // Active executing node name (identifying exact nodes in graph/subgraph, tools, and middleware)
  const activeNode = useMemo(() => {
    // 1. If we are waiting for human input (HITL)
    if (status === "WAITING_HITL") {
      const nextNodes = threadState?.next || [];
      return nextNodes.length > 0 ? nextNodes.join(", ") : "human";
    }

    // 2. Check current executing tasks in the state (includes subgraph and tool execution nodes)
    const tasks = threadState?.tasks || [];
    if (tasks.length > 0) {
      const activeTaskNames = tasks.map((t: any) => t.name);
      
      // If the active task is a generic parent node like "agent" or "before_run", 
      // we inspect the message history to identify the specific subgraph phase.
      if (activeTaskNames.includes("agent") || activeTaskNames.includes("before_run")) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg) {
          if (lastMsg.type === "human") {
            return "agent:model"; // User spoke, agent LLM is next/running
          }
          if (lastMsg.type === "ai") {
            const toolCalls = lastMsg.tool_calls || [];
            if (toolCalls.length > 0) {
              const toolNames = toolCalls.map((tc: any) => tc.name).join(", ");
              return `agent:tools [${toolNames}]`; // LLM called tools, tool execution node is active
            }
            return "agent:model"; // LLM is executing/generating response text
          }
          if (lastMsg.type === "tool") {
            return "agent:model"; // Tool returned, agent LLM is processing the result
          }
        }
      }
      return activeTaskNames.join(", ");
    }

    // 3. Fallback for running status based on last message
    if (status === "RUNNING") {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg) {
        if (lastMsg.type === "ai" && lastMsg.tool_calls && lastMsg.tool_calls.length > 0) {
          const toolNames = lastMsg.tool_calls.map((tc: any) => tc.name).join(", ");
          return `agent:tools [${toolNames}]`;
        }
        if (lastMsg.type === "human" || lastMsg.type === "tool") {
          return "agent:model";
        }
      }
      return "Running...";
    }
    return null;
  }, [status, threadState, messages]);

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between h-[360px]">
      
      {/* 1. Header Area */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Thread</span>
            <span className="font-mono text-xs font-bold text-slate-700 truncate max-w-[120px]" title={threadId}>
              {threadId}
            </span>
            <button 
              onClick={handleCopy}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-50 shrink-0"
              title="Copy Thread ID"
            >
              {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Status Badge */}
            {status === "RUNNING" && (
              <span className="flex items-center gap-1 text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Running
              </span>
            )}
            {status === "WAITING_HITL" && (
              <span className="flex items-center gap-1 text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                <AlertTriangle className="size-2.5 text-amber-500" />
                HITL Blocked
              </span>
            )}
            {status === "ERROR" && (
              <span className="flex items-center gap-1 text-[9px] font-bold bg-rose-50 text-rose-600 border border-rose-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                <AlertCircle className="size-2.5 text-rose-500" />
                Error
              </span>
            )}
            {status === "IDLE" && (
              <span className="flex items-center gap-1 text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Idle
              </span>
            )}

            {/* Auto-run Toggle Badge */}
            <button
              onClick={handleToggleAutoRun}
              disabled={isTogglingActive}
              className={cn(
                "flex items-center gap-1 text-[9px] font-bold border px-1.5 py-0.5 rounded-full uppercase tracking-wider transition-all select-none shrink-0",
                isActive 
                  ? "bg-indigo-50 text-indigo-650 border-indigo-200 hover:bg-indigo-100" 
                  : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
              )}
              title={isActive ? "Disable Auto-run (agent will not auto execute)" : "Enable Auto-run (agent auto executes)"}
              type="button"
            >
              <span className={cn("h-1 w-1 rounded-full", isActive ? "bg-indigo-500 animate-pulse" : "bg-slate-350")} />
              {isActive ? "Auto" : "Manual"}
            </button>

            {/* Execution Timer Badge */}
            {status === "RUNNING" && elapsedTime !== null && (
              <span className="flex items-center gap-1 text-[9px] font-mono font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded-full tracking-wider animate-pulse">
                <Clock className="size-2.5 animate-spin text-indigo-500" />
                {elapsedTime.toFixed(2)}s
              </span>
            )}
            {status !== "RUNNING" && finalDuration !== null && finalDuration > 0 && (
              <span className="flex items-center gap-1 text-[9px] font-mono font-medium bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full tracking-wider">
                Ran for {finalDuration.toFixed(2)}s
              </span>
            )}
          </div>
        </div>

        {/* 2. Metadata / Run Info (compact inline layout) */}
        <div className="flex items-center gap-3 text-[10px] text-slate-500 bg-slate-50/70 px-2.5 py-1.5 rounded-lg border border-slate-100/85 mt-1">
          <div className="flex items-center gap-1 min-w-0">
            <User className="size-3 text-slate-400 shrink-0" />
            <span className="text-slate-400 font-bold uppercase text-[8px] tracking-wider shrink-0">Assignee:</span>
            <span className="font-semibold text-slate-700 capitalize truncate">
              {threadState?.values?.extra?.assignee || "Agent"}
            </span>
          </div>
          <div className="h-3.5 w-[1px] bg-slate-200 shrink-0" />
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <Cpu className="size-3 text-slate-400 shrink-0" />
            <span className="text-slate-400 font-bold uppercase text-[8px] tracking-wider shrink-0">Node:</span>
            <span className={cn(
              "font-semibold truncate",
              activeNode ? "text-indigo-600 font-mono" : "text-slate-500"
            )}>
              {activeNode || "None"}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Event Terminal Timeline */}
      <div className="flex-grow my-3 flex flex-col justify-end min-h-0">
        <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3 flex flex-col gap-2 h-[170px] overflow-y-auto font-mono text-[10px] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-track]:bg-transparent">
          <div className="flex items-center gap-1 text-[9px] text-slate-400 border-b border-slate-200/60 pb-1.5 mb-1 select-none">
            <Terminal className="size-3 text-slate-400" />
            <span>AGENT RUN LOGS</span>
          </div>
          
          {recentMessages.length === 0 ? (
            <div className="text-slate-400 italic py-4 text-center">
              No message logs found
            </div>
          ) : (
            recentMessages.map((msg, idx) => {
              if (msg.type === "human") {
                return (
                  <div key={msg.id || idx} className="text-sky-700 line-clamp-2">
                    <span className="text-sky-600 font-bold">User:</span> {getContentString(msg.content)}
                  </div>
                );
              }
              if (msg.type === "ai") {
                const toolCalls = msg.tool_calls || [];
                if (toolCalls.length > 0) {
                  return (
                    <div key={msg.id || idx} className="text-amber-700 flex flex-col gap-0.5">
                      {toolCalls.map((tc: any, tcIdx: number) => (
                        <div key={tc.id || tcIdx} className="truncate">
                          <span className="text-amber-600 font-bold">🛠️ Call:</span> {tc.name}({JSON.stringify(tc.args)})
                        </div>
                      ))}
                    </div>
                  );
                }
                return (
                  <div key={msg.id || idx} className="text-emerald-700 line-clamp-2">
                    <span className="text-emerald-600 font-bold">Agent:</span> {getContentString(msg.content)}
                  </div>
                );
              }
              if (msg.type === "tool") {
                return (
                  <div key={msg.id || idx} className="text-purple-700 truncate">
                    <span className="text-purple-600 font-bold">⚙️ Return:</span> {msg.name} {"->"} {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
                  </div>
                );
              }
              return (
                <div key={msg.id || idx} className="text-slate-600 truncate">
                  <span className="text-slate-500 font-bold">{msg.type}:</span> {getContentString(msg.content)}
                </div>
              );
            })
          )}

          {/* Real-time thinking animation */}
          {status === "RUNNING" && (
            <div className="text-slate-400 italic animate-pulse flex items-center gap-1 select-none">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '300ms' }} />
              <span>Agent is active...</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Controls Footer */}
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div className="flex gap-2">
          {/* Refresh Action */}
          <Button
            size="icon"
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-8 w-8 rounded-lg border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
            title="Refresh state"
            type="button"
          >
            <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
          </Button>

          {/* Toggle Active Action */}
          <Button
            size="icon"
            variant="outline"
            onClick={handleToggleActive}
            className={cn(
              "h-8 w-8 rounded-lg border-slate-200 transition-all",
              status === "RUNNING"
                ? "border-rose-200 text-rose-500 hover:bg-rose-500 hover:text-white hover:border-rose-500"
                : "border-emerald-200 text-emerald-600 hover:bg-emerald-600 hover:text-white hover:border-emerald-600"
            )}
            title={status === "RUNNING" ? "Pause execution" : "Resume / Start execution"}
            type="button"
          >
            {status === "RUNNING" ? <Pause className="size-3.5" /> : <Play className="size-3.5 fill-current" />}
          </Button>
        </div>

        {/* Observe Action */}
        <Button
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 shadow-xs hover:scale-102 transition-all"
          asChild
        >
          <Link href={makeAdminLink(threadId)}>
            <Eye className="size-3.5" />
            Observe Full
          </Link>
        </Button>
      </div>

    </div>
  );
}
