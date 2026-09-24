"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Shield,
  ArrowLeft,
  Copy,
  Check,
  RefreshCw,
  Cpu,
  Wrench,
  Activity,
  CheckCircle2,
  MessageSquare
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/common/ui/card";
import { Button } from "@/components/common/ui/button";
import { toast } from "sonner";
import { Toaster } from "@/components/common/ui/sonner";
import { API_CONFIG } from "@/config/api";
import Link from "next/link";

interface ToolConfig {
  name: string;
  description: string;
}

interface PromptConfig {
  name: string;
  title: string;
  value: string;
}

interface AgentInfo {
  id: string;
  name: string;
  assistant_id: string;
  description: string;
  prompts: PromptConfig[];
  tools: ToolConfig[];
  status: string;
}

export default function GuardianAgentDetailPage() {
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePromptTab, setActivePromptTab] = useState<string>("");
  const [copiedName, setCopiedName] = useState<string | null>(null);

  const fetchAgentConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_CONFIG.rulesEngineBaseUrl}/api/smart-return/agent/all-configs`);
      if (!res.ok) throw new Error("Failed to fetch agent configs");
      const data: AgentInfo[] = await res.json();
      const matched = data.find(a => a.id === "guardian_graph");
      if (matched) {
        setAgent(matched);
        if (matched.prompts && matched.prompts.length > 0) {
          setActivePromptTab(matched.prompts[0].name);
        }
      } else {
        throw new Error("Guardian Graph Agent not found in configs");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Không thể tải cấu hình của Guardian Agent");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgentConfig();
  }, [fetchAgentConfig]);

  const handleCopyPrompt = (name: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedName(name);
    toast.success(`Đã sao chép prompt ${name}`);
    setTimeout(() => setCopiedName(null), 2000);
  };

  const activePrompt = agent?.prompts.find(p => p.name === activePromptTab);

  return (
    <div className="min-h-screen bg-slate-55/50 p-6 md:p-8 font-sans admin-theme text-slate-800 flex flex-col gap-6 select-none">
      <Toaster position="top-right" />
      
      {/* Breadcrumbs */}
      <div className="flex items-center gap-3">
        <Link href="/admin/agent">
          <button className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-all cursor-pointer bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-3xs">
            <ArrowLeft className="size-3.5" />
            Quay lại Quản lý Agent
          </button>
        </Link>
        <span className="text-slate-300">|</span>
        <span className="text-xs font-bold text-slate-400">Guardian Graph Detail</span>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100 shadow-2xs space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-650" />
          <p className="text-xs text-slate-455 font-extrabold">Đang tải cấu hình chi tiết Guardian Graph từ LangGraph schemas...</p>
        </div>
      ) : !agent ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100 shadow-2xs space-y-2">
          <Shield className="h-10 w-10 text-slate-350 animate-bounce" />
          <p className="text-xs font-black text-slate-455">Không tìm thấy thông tin cấu hình của Guardian Graph Agent</p>
        </div>
      ) : (
        <>
          {/* Header Panel */}
          <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-2xs text-left flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="size-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-3xs shrink-0 text-indigo-600">
                <Shield className="h-7 w-7 animate-pulse" />
              </div>
              <div>
                <h1 className="text-lg font-black text-slate-850 tracking-tight flex items-center gap-2">
                  {agent.name}
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[9px] font-extrabold text-emerald-600 border border-emerald-100">
                    <CheckCircle2 className="size-3" />
                    {agent.status}
                  </span>
                </h1>
                <p className="text-xs text-slate-400 font-bold mt-1">
                  {agent.description}
                </p>
              </div>
            </div>

            <Button 
              variant="outline"
              onClick={fetchAgentConfig}
              className="bg-slate-55 hover:bg-slate-100 text-slate-700 rounded-xl px-4 py-2.5 text-xs font-extrabold flex items-center justify-center gap-2 border border-slate-200 cursor-pointer w-full md:w-auto shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Làm Mới
            </Button>
          </div>

          {/* Details Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            
            {/* System Prompt (2/3 width) */}
            <div className="lg:col-span-2 flex flex-col gap-3">
              <Card className="bg-white border-slate-100 shadow-2xs rounded-2xl overflow-hidden text-left flex flex-col h-full">
                <CardHeader className="bg-slate-55 px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Cpu className="size-4 text-indigo-650" />
                    <CardTitle className="text-sm font-extrabold text-slate-800">
                      Prompts Cấu Hình Chi Tiết
                    </CardTitle>
                  </div>
                  
                  {/* Tabs selector */}
                  <div className="flex bg-slate-200 p-0.5 rounded-lg w-fit">
                    {agent.prompts.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActivePromptTab(p.name)}
                        className={`px-3 py-1 text-[10px] font-extrabold rounded-md transition-all ${
                          activePromptTab === p.name
                            ? "bg-white text-indigo-650 shadow-3xs"
                            : "text-slate-500 hover:text-slate-850"
                        }`}
                      >
                        {p.title}
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="p-6 flex-1 flex flex-col gap-3 bg-slate-55/10">
                  {activePrompt ? (
                    <>
                      <div className="flex items-center justify-between select-none">
                        <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                          Mã biến: {activePrompt.name}
                        </span>
                        <button
                          onClick={() => handleCopyPrompt(activePrompt.name, activePrompt.value)}
                          className="flex items-center gap-1 text-[10px] font-bold text-indigo-650 hover:text-indigo-800 transition-colors cursor-pointer bg-white border border-slate-200 px-2.5 py-1 rounded-lg"
                        >
                          {copiedName === activePrompt.name ? (
                            <>
                              <Check className="size-3" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="size-3" />
                              Copy Prompt
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex-1 min-h-[350px] bg-slate-900 text-slate-200 p-4 rounded-xl border border-slate-800 font-mono text-[11px] leading-relaxed overflow-y-auto whitespace-pre-wrap">
                        {activePrompt.value || "Không ghi nhận dữ liệu prompt mặc định trên Graph."}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-400 italic">Chọn một prompt để xem chi tiết.</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Tools Panel (1/3 width) */}
            <div className="flex flex-col gap-6">
              
              {/* Active Tools */}
              <Card className="bg-white border-slate-100 shadow-2xs rounded-2xl overflow-hidden text-left flex flex-col h-full">
                <CardHeader className="bg-slate-55 px-5 py-4 border-b border-slate-100">
                  <CardTitle className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                    <Wrench className="size-4 text-indigo-650" />
                    Allocated Tools ({agent.tools.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-3 flex-1 overflow-y-auto max-h-[450px]">
                  {agent.tools.length > 0 ? (
                    agent.tools.map((tool, tIdx) => (
                      <div 
                        key={tIdx}
                        className="bg-white border border-slate-150 p-3 rounded-xl shadow-3xs space-y-1"
                      >
                        <span className="text-xs font-black text-indigo-700 block font-mono">
                          {tool.name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold block leading-relaxed">
                          {tool.description}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-400 italic">Không có công cụ nào được phân bổ.</div>
                  )}
                </CardContent>
              </Card>

            </div>

          </div>
        </>
      )}
    </div>
  );
}
