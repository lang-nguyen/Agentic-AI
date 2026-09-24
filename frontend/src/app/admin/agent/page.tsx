"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Bot,
  Shield,
  Zap,
  RefreshCw,
  Cpu,
  Wrench,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  ClipboardList
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

// 1. Guardian Graph Agent Card (User facing Orchestrator)
function GuardianGraphCard({ agent }: { agent: AgentInfo | undefined }) {
  if (!agent) return null;
  return (
    <Card className="bg-white border-slate-100 shadow-2xs rounded-2xl overflow-hidden text-left flex flex-col justify-between hover:shadow-xs transition-all duration-200 col-span-1">
      <div>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-indigo-50/20">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-3xs shrink-0 text-indigo-600">
              <Shield className="size-5" />
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-400 block uppercase tracking-wider">Tác tử Điều phối Trò chuyện</span>
              <h3 className="text-xs font-black text-slate-850">{agent.name}</h3>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold border bg-emerald-50 text-emerald-600 border-emerald-100">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold block">ASSISTANT ID:</span>
            <span className="text-[10px] font-bold text-slate-600 font-mono block bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 select-all w-fit">
              {agent.assistant_id}
            </span>
          </div>

          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
            {agent.description}
          </p>

          {/* Prompts managed by this assistant */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
              <Cpu className="size-3" />
              Prompts cấu hình ({agent.prompts.length})
            </span>
            <div className="grid grid-cols-2 gap-2">
              {agent.prompts.map((p, idx) => (
                <div key={idx} className="p-2 rounded-lg bg-slate-50 border border-slate-150 text-[10px] font-bold text-slate-700 flex flex-col gap-0.5">
                  <span className="text-[8px] text-slate-400 uppercase">{p.name}</span>
                  <span className="truncate">{p.title}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tools List */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
              <Wrench className="size-3" />
              Công cụ gán quyền ({agent.tools.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {agent.tools.slice(0, 3).map((tool, idx) => (
                <span 
                  key={idx} 
                  className="bg-slate-100 border border-slate-200 text-slate-650 font-mono text-[9px] font-bold px-2 py-0.5 rounded-md"
                >
                  {tool.name}
                </span>
              ))}
              {agent.tools.length > 3 && (
                <span className="bg-slate-100 border border-slate-200 text-slate-400 font-mono text-[9px] font-bold px-2 py-0.5 rounded-md">
                  +{agent.tools.length - 3} khác
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 pt-0">
        <Link href="/admin/agent/guardian">
          <Button className="w-full bg-slate-55 hover:bg-slate-100 text-slate-700 rounded-xl py-2.5 text-xs font-black flex items-center justify-center gap-1.5 border border-slate-200 cursor-pointer shadow-3xs">
            Cấu hình Prompts & Xem chi tiết
            <ChevronRight className="size-3.5" />
          </Button>
        </Link>
      </div>
    </Card>
  );
}

// 2. Autonomous Return Agent Card
function AutonomousReturnAgentCard({ 
  agent, 
  enabled, 
  onToggle, 
  toggling 
}: { 
  agent: AgentInfo | undefined; 
  enabled: boolean; 
  onToggle: () => void; 
  toggling: boolean;
}) {
  if (!agent) return null;
  return (
    <Card className="bg-white border-slate-100 shadow-2xs rounded-2xl overflow-hidden text-left flex flex-col justify-between hover:shadow-xs transition-all duration-200 col-span-1">
      <div>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-50/20">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-3xs shrink-0 text-emerald-600">
              <Zap className="size-5" />
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-400 block uppercase tracking-wider">Tác tử Quyết định Tự chủ</span>
              <h3 className="text-xs font-black text-slate-850">{agent.name}</h3>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold border ${
            enabled 
              ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
              : "bg-slate-100 text-slate-400 border-slate-200"
          }`}>
            <span className={`size-1.5 rounded-full ${enabled ? "bg-emerald-500 animate-pulse" : "bg-slate-350"}`} />
            {enabled ? "Active" : "Disabled"}
          </span>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold block">ASSISTANT ID:</span>
            <span className="text-[10px] font-bold text-slate-600 font-mono block bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 select-all w-fit">
              {agent.assistant_id}
            </span>
          </div>

          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
            {agent.description}
          </p>

          {/* Quick toggle for background processing */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
            <div className="space-y-0.5">
              <span className="font-extrabold text-slate-800 block">Quyền duyệt tự động</span>
              <span className="text-[9px] text-slate-400 font-bold block">Xử lý nền không cần phê duyệt thủ công</span>
            </div>
            <button
              type="button"
              onClick={onToggle}
              disabled={toggling}
              className="focus:outline-none cursor-pointer disabled:opacity-50"
            >
              {enabled ? (
                <ToggleRight className="h-8 w-8 text-indigo-600" />
              ) : (
                <ToggleLeft className="h-8 w-8 text-slate-400" />
              )}
            </button>
          </div>

          {/* Tools List */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
              <Wrench className="size-3" />
              Công cụ toàn quyền ({agent.tools.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              <span className="bg-slate-100 border border-slate-200 text-slate-650 font-mono text-[9px] font-bold px-2 py-0.5 rounded-md">
                Tất cả công cụ kho & đơn hàng
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 pt-0">
        <Link href="/admin/agent/autonomous-return">
          <Button className="w-full bg-slate-55 hover:bg-slate-100 text-slate-700 rounded-xl py-2.5 text-xs font-black flex items-center justify-center gap-1.5 border border-slate-200 cursor-pointer shadow-3xs">
            Xem nhật ký & Quản lý
            <ChevronRight className="size-3.5" />
          </Button>
        </Link>
      </div>
    </Card>
  );
}

export default function AgentManagementPage() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [agenticEnabled, setAgenticEnabled] = useState(true);
  const [toggling, setToggling] = useState(false);

  const fetchAgentsAndStatus = useCallback(async () => {
    try {
      setLoading(true);
      
      const resConfigs = await fetch(`${API_CONFIG.rulesEngineBaseUrl}/api/smart-return/agent/all-configs`);
      if (!resConfigs.ok) throw new Error("Failed to fetch agent configurations");
      const dataConfigs = await resConfigs.json();
      setAgents(dataConfigs);

      const resStatus = await fetch(`${API_CONFIG.rulesEngineBaseUrl}/api/smart-return/agent/config`);
      if (resStatus.ok) {
        const dataStatus = await resStatus.json();
        setAgenticEnabled(dataStatus.agentic_enabled);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Không thể tải thông tin hệ thống AI Agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgentsAndStatus();
  }, [fetchAgentsAndStatus]);

  const handleToggleAgentic = async () => {
    try {
      setToggling(true);
      const res = await fetch(`${API_CONFIG.rulesEngineBaseUrl}/api/smart-return/agent/toggle`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Failed to toggle agent status");
      const data = await res.json();
      setAgenticEnabled(data.agentic_enabled);
      toast.success(data.agentic_enabled ? "Đã BẬT quyền tự quyết của AI Agent" : "Đã TẮT quyền tự quyết của AI Agent");
      
      fetchAgentsAndStatus();
    } catch (err: any) {
      console.error(err);
      toast.error("Không thể thay đổi quyền tự quyết");
    } finally {
      setToggling(false);
    }
  };

  const guardianGraphAgent = agents.find(a => a.id === "guardian_graph");
  const autonomousReturnAgent = agents.find(a => a.id === "autonomous_return_agent");

  return (
    <div className="min-h-screen bg-slate-55/50 p-6 md:p-8 font-sans admin-theme text-slate-800 flex flex-col gap-6 select-none">
      <Toaster position="top-right" />
      
      {/* Title Header Panel */}
      <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-2xs text-left flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-3xs shrink-0">
            <Cpu className="h-7 w-7 text-indigo-650 animate-bounce-slow" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-850 tracking-tight flex items-center gap-2">
              Agent Management
            </h1>
            <p className="text-xs text-slate-400 font-bold mt-1">
              Bảng quản trị liên kết trực tiếp với LangGraph API để hiển thị danh sách và thông tin chi tiết các AI Agent.
            </p>
          </div>
        </div>

        <Button 
          variant="outline"
          onClick={fetchAgentsAndStatus}
          className="bg-slate-55 hover:bg-slate-100 text-slate-700 rounded-xl px-4 py-2.5 text-xs font-extrabold flex items-center justify-center gap-2 border border-slate-200 cursor-pointer w-full md:w-auto shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Làm Mới Hệ Thống
        </Button>
      </div>

      {/* Grid of 2 LangGraph agents */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="md:col-span-2 flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100 shadow-2xs space-y-3">
            <RefreshCw className="h-8 w-8 animate-spin text-indigo-650" />
            <p className="text-xs text-slate-455 font-extrabold">Đang tải thông tin các AI Agent từ LangGraph API...</p>
          </div>
        ) : (
          <>
            {/* Guardian Graph Card */}
            <GuardianGraphCard agent={guardianGraphAgent} />

            {/* Autonomous Return Card */}
            <AutonomousReturnAgentCard 
              agent={autonomousReturnAgent} 
              enabled={agenticEnabled} 
              onToggle={handleToggleAgentic}
              toggling={toggling}
            />
          </>
        )}
      </div>

    </div>
  );
}
