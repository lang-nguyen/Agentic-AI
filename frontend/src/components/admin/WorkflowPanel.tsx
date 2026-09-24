import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, useDragControls } from "framer-motion";
import { 
  Network, X, Plus, Minus, CheckCircle2, 
  Hourglass, Brain, Zap, Eye, Loader2, Maximize2, Minimize2, ExternalLink, Anchor, Sun
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/common/ui/button";
import { getContentString } from "./utils";
import { useQueryState } from "nuqs";
import { createClient } from "@/providers/client";

interface WorkflowPanelProps {
  isOpen: boolean;
  onClose: () => void;
  message: any;
  allMessages: any[];
  isLoading: boolean;
  streamInterrupt: any;
  selectedCheckpointId?: string | null;
}

const FALLBACK_GRAPH = {
  nodes: [
    { id: "__start__", type: "runnable", data: { name: "__start__" } },
    { id: "before_run", type: "runnable", data: { name: "before_run" } },
    { id: "human", type: "runnable", data: { name: "human" } },
    { id: "__end__" },
    { id: "agent:__start__", type: "runnable", data: { name: "agent:__start__" } },
    { id: "agent:model", type: "runnable", data: { name: "agent:model" } },
    { id: "agent:tools", type: "runnable", data: { name: "agent:tools" } },
    { id: "agent:save_thread.after_model", type: "runnable", data: { name: "agent:save_thread.after_model" } },
    { id: "agent:__end__" }
  ],
  edges: [
    { source: "__start__", target: "before_run" },
    { source: "agent:__end__", target: "human", conditional: true },
    { source: "before_run", target: "agent:__start__", conditional: true },
    { source: "before_run", target: "human", conditional: true },
    { source: "human", target: "__end__" },
    { source: "agent:__start__", target: "agent:model" },
    { source: "agent:model", target: "agent:save_thread.after_model" },
    { source: "agent:save_thread.after_model", target: "agent:__end__", conditional: true },
    { source: "agent:save_thread.after_model", target: "agent:model", conditional: true },
    { source: "agent:save_thread.after_model", target: "agent:tools", conditional: true },
    { source: "agent:tools", target: "agent:model", conditional: true }
  ]
};

const getActiveNodeForCheckpoint = (checkpoint: any): string | null => {
  if (!checkpoint) return null;
  
  const tasks = checkpoint.tasks || [];
  if (tasks.length > 0) {
    const nodeName = tasks[0].name || "";
    if (nodeName.includes("model") || nodeName.includes("agent")) return "agent:model";
    if (nodeName.includes("tools")) return "agent:tools";
    if (nodeName !== "__start__" && nodeName !== "__end__" && nodeName !== "human") {
      return "agent:tools";
    }
    return nodeName;
  }
  
  const writes = checkpoint.metadata?.writes || {};
  const writeNodes = Object.keys(writes);
  if (writeNodes.length > 0) {
    if (writes.human) return "human";
    const firstNode = writeNodes[0];
    if (firstNode.includes("model") || firstNode.includes("agent")) return "agent:model";
    if (firstNode.includes("tools")) return "agent:tools";
    if (firstNode !== "__start__" && firstNode !== "__end__" && firstNode !== "human") {
      return "agent:tools";
    }
  }

  const parentId = (typeof checkpoint.parent_checkpoint === "object"
    ? checkpoint.parent_checkpoint?.checkpoint_id
    : checkpoint.parent_checkpoint) || null;
  if (parentId === null) return "before_run";

  return "__end__";
};

const generateMermaidChart = (
  nodes: any[],
  edges: any[],
  activeNodeId: string | null,
  isHighlightMode: boolean
) => {
  let chart = "flowchart TD\n";
  
  // Custom Styles
  chart += "  classDef active fill:#e0e7ff,stroke:#6366f1,stroke-width:2.5px,color:#312e81,opacity:1;\n";
  chart += "  classDef normal fill:#ffffff,stroke:#cbd5e1,color:#334155;\n";
  chart += "  classDef endpoint fill:#cccccc,stroke:#1e293b,color:#000000;\n";
  chart += "  classDef beforerun fill:#f3e8ff,stroke:#a855f7,color:#6b21a8;\n";
  chart += "  classDef humanNode fill:#eff6ff,stroke:#3b82f6,color:#1d4ed8;\n";
  chart += "  classDef toolNode fill:#fef3c7,stroke:#b45309,color:#78350f;\n";
  chart += "  classDef modelNode fill:#ccfbf1,stroke:#0d9488,color:#115e59;\n";

  // Dimmed variants
  chart += "  classDef normal_dimmed fill:#ffffff,stroke:#cbd5e1,color:#334155,opacity:0.25;\n";
  chart += "  classDef endpoint_dimmed fill:#cccccc,stroke:#1e293b,color:#000000,opacity:0.25;\n";
  chart += "  classDef beforerun_dimmed fill:#f3e8ff,stroke:#a855f7,color:#6b21a8,opacity:0.25;\n";
  chart += "  classDef humanNode_dimmed fill:#eff6ff,stroke:#3b82f6,color:#1d4ed8,opacity:0.25;\n";
  chart += "  classDef toolNode_dimmed fill:#fef3c7,stroke:#b45309,color:#78350f,opacity:0.25;\n";
  chart += "  classDef modelNode_dimmed fill:#ccfbf1,stroke:#0d9488,color:#115e59,opacity:0.25;\n";

  // Separate agent nodes from main nodes
  const agentNodes = nodes.filter((n) => n.id.startsWith("agent:"));
  const outerNodes = nodes.filter((n) => !n.id.startsWith("agent:"));

  const renderNode = (n: any) => {
    const isStartOrEnd = n.id === "__start__" || n.id === "__end__" || n.id === "agent:__end__" || n.id === "agent:__start__";
    let label = n.data?.name || n.id;
    if (label.startsWith("agent:")) {
      label = label.replace("agent:", "");
    }
    const safeLabel = label.replace(/"/g, "'");
    
    let shape = `["${safeLabel}"]`;
    if (isStartOrEnd) {
      shape = `("${safeLabel}")`;
    }
    
    return `  ${n.id.replace(/:/g, "_")}${shape}\n`;
  };

  // Render outer nodes
  outerNodes.forEach((n) => {
    chart += renderNode(n);
  });

  // Render agent subgraph
  if (agentNodes.length > 0) {
    chart += "  subgraph agent [fa:fa-network-wired agent]\n";
    const isAgentExecuting = activeNodeId && activeNodeId.startsWith("agent:");
    if (isHighlightMode && !isAgentExecuting) {
      chart += "    style agent fill:#faf5ff,stroke:#c084fc,stroke-width:1.5px,color:#701a75,opacity:0.25;\n";
    } else {
      chart += "    style agent fill:#faf5ff,stroke:#c084fc,stroke-width:2px,color:#701a75;\n";
    }
    agentNodes.forEach((n) => {
      chart += "  " + renderNode(n);
    });
    chart += "  end\n";
  }

  // Define edges
  edges.forEach((e) => {
    const sourceId = e.source.replace(/:/g, "_");
    const targetId = e.target.replace(/:/g, "_");
    
    let arrow = "-->";
    if (e.conditional) {
      arrow = "-.->";
    }
    
    // Customize arrow colors / directions to match screenshot
    if (e.source.startsWith("agent:") && e.target.startsWith("agent:")) {
      chart += `  ${sourceId} ${arrow} ${targetId}\n`;
    } else {
      chart += `  ${sourceId} ${arrow} ${targetId}\n`;
    }
  });

  // Assign styling classes
  nodes.forEach((n) => {
    const safeId = n.id.replace(/:/g, "_");
    const isStartOrEnd = n.id === "__start__" || n.id === "__end__" || n.id === "agent:__end__" || n.id === "agent:__start__";
    
    let baseClass = "normal";
    if (isStartOrEnd) {
      baseClass = "endpoint";
    } else if (n.id.includes("before_run") || n.id.includes("save_thread")) {
      baseClass = "beforerun";
    } else if (n.id.includes("human")) {
      baseClass = "humanNode";
    } else if (n.id.includes("tool")) {
      baseClass = "toolNode";
    } else if (n.id.includes("model")) {
      baseClass = "modelNode";
    }
    
    if (isHighlightMode) {
      if (n.id === activeNodeId) {
        chart += `  class ${safeId} active;\n`;
      } else {
        chart += `  class ${safeId} ${baseClass}_dimmed;\n`;
      }
    } else {
      if (n.id === activeNodeId) {
        chart += `  class ${safeId} active;\n`;
      } else {
        chart += `  class ${safeId} ${baseClass};\n`;
      }
    }
  });

  return chart;
};

const parseToolCalls = (msg: any) => {
  if (!msg) return [];
  if (msg.tool_calls && msg.tool_calls.length > 0) {
    return msg.tool_calls;
  }
  
  if (msg.additional_kwargs?.tool_calls && msg.additional_kwargs.tool_calls.length > 0) {
    return msg.additional_kwargs.tool_calls.map((tc: any) => {
      let args = {};
      try {
        args = typeof tc.function?.arguments === "string" ? JSON.parse(tc.function.arguments) : (tc.args || {});
      } catch (e) {}
      return {
        name: tc.function?.name || tc.name || "",
        args,
        id: tc.id || ""
      };
    });
  }

  if (msg.additional_kwargs?.function_call) {
    const fc = msg.additional_kwargs.function_call;
    let args = {};
    try {
      args = typeof fc.arguments === "string" ? JSON.parse(fc.arguments) : (fc.arguments || {});
    } catch (e) {}
    return [{
      name: fc.name || "",
      args,
      id: ""
    }];
  }
  
  if (Array.isArray(msg.content)) {
    const toolUseBlocks = msg.content.filter((c: any) => c && (c.type === "tool_use" || c.type === "tool_call"));
    if (toolUseBlocks.length > 0) {
      return toolUseBlocks.map((block: any) => {
        let args = {};
        try {
          if (block.input) {
            args = typeof block.input === "string" ? JSON.parse(block.input) : block.input;
          } else if (block.args) {
            args = typeof block.args === "string" ? JSON.parse(block.args) : block.args;
          }
        } catch (e) {}
        return {
          name: block.name || "",
          args,
          id: block.id || ""
        };
      });
    }
  }
  
  return [];
};

export function WorkflowPanel({
  isOpen,
  onClose,
  message,
  allMessages,
  isLoading,
  streamInterrupt,
  selectedCheckpointId
}: WorkflowPanelProps) {
  const [zoomGraph, setZoomGraph] = useState(100);
  const [zoomFlow, setZoomFlow] = useState(100);
  const [svgHtml, setSvgHtml] = useState<string>("");
  const [history, setHistory] = useState<any[]>([]);
  const [width, setWidth] = useState(420);
  const [resetKey, setResetKey] = useState(0);
  const [activeTab, setActiveTab] = useState<"graph" | "flow">("flow");
  const [isGraphUndocked, setIsGraphUndocked] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [detailStep, setDetailStep] = useState<any | null>(null);
  const [showMessageIdsExpanded, setShowMessageIdsExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const dragControls = useDragControls();

  const [floatWidth, setFloatWidth] = useState(380);
  const [floatHeight, setFloatHeight] = useState(380);
  const [isHighlightBypassed, setIsHighlightBypassed] = useState(false);
  const [windowWidth, setWindowWidth] = useState(1200);

  // Determine active node
  const activeNodeId = useMemo(() => {
    if (!message) return null;
    if (streamInterrupt) return "human";
    
    const toolCalls = message.tool_calls || [];
    if (toolCalls.length > 0) {
      const hasPendingOrRunning = toolCalls.some((tc: any) => 
        !allMessages.some((m: any) => m.type === "tool" && m.tool_call_id === tc.id)
      );
      if (hasPendingOrRunning || isLoading) {
        return "agent:tools";
      }
    }
    
    if (isLoading) {
      return "agent:model";
    }
    
    return "__end__";
  }, [message, allMessages, isLoading, streamInterrupt]);

  useEffect(() => {
    setIsHighlightBypassed(false);
  }, [selectedCheckpointId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setWindowWidth(window.innerWidth);
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const startFloatResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    mouseDownEvent.stopPropagation();
    const startX = mouseDownEvent.clientX;
    const startY = mouseDownEvent.clientY;
    const startWidth = floatWidth;
    const startHeight = floatHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      setFloatWidth(Math.max(250, startWidth + deltaX));
      setFloatHeight(Math.max(250, startHeight + deltaY));
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [floatWidth, floatHeight]);

  const zoom = activeTab === "flow" ? zoomFlow : zoomGraph;
  const setZoom = useCallback((val: number | ((prev: number) => number)) => {
    if (activeTab === "flow") {
      setZoomFlow(val);
    } else {
      setZoomGraph(val);
    }
  }, [activeTab]);

  useEffect(() => {
    setShowMessageIdsExpanded(false);
  }, [detailStep]);
  const flowScrollRef = useRef<HTMLDivElement>(null);

  // Set ref callback to ensure event listener is registered as non-passive immediately when the element mounts
  const setPanelRef = useCallback((node: HTMLDivElement | null) => {
    if (panelRef.current) {
      const oldHandler = (panelRef.current as any)._zoomWheelHandler;
      if (oldHandler) {
        panelRef.current.removeEventListener("wheel", oldHandler);
      }
    }

    panelRef.current = node;

    if (node) {
      const handleWheel = (e: WheelEvent) => {
        if (e.ctrlKey) {
          e.preventDefault();
          setZoom((prev) => {
            const delta = e.deltaY < 0 ? 5 : -5;
            return activeTab === "flow" 
              ? Math.max(70, Math.min(150, prev + delta))
              : Math.max(50, Math.min(200, prev + delta));
          });
        }
      };

      (node as any)._zoomWheelHandler = handleWheel;
      node.addEventListener("wheel", handleWheel, { passive: false });
    }
  }, []);

  const floatingViewportRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const handleFloatingWheel = (e: WheelEvent) => {
        if (e.ctrlKey) {
          e.preventDefault();
          e.stopPropagation();
          setZoomGraph((prev) => {
            const delta = e.deltaY < 0 ? 5 : -5;
            return Math.max(50, Math.min(200, prev + delta));
          });
        }
      };
      node.addEventListener("wheel", handleFloatingWheel, { passive: false });
    }
  }, []);


  const [apiUrl] = useQueryState("apiUrl");
  const [assistantId] = useQueryState("assistantId");
  const [threadId] = useQueryState("threadId");
  const [graphData, setGraphData] = useState<{ nodes: any[]; edges: any[] } | null>(FALLBACK_GRAPH);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX;
      const newWidth = Math.max(300, Math.min(window.innerWidth - 50, startWidth + deltaX));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Listen for clicks inside the compiled SVG container to detect node selection
  const handleSvgClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent default browser popup, text selection, or search menus
    e.preventDefault();
    e.stopPropagation();

    const target = e.target as HTMLElement;
    // Find closest element with an id starting with flowchart-
    const nodeEl = target.closest("[id^='flowchart-']");
    if (!nodeEl) return;
    
    const idAttr = nodeEl.getAttribute("id") || "";
    let rawNodeId = idAttr;
    if (rawNodeId.startsWith("flowchart-")) {
      rawNodeId = rawNodeId.replace("flowchart-", "");
    }
    const lastDashIdx = rawNodeId.lastIndexOf("-");
    if (lastDashIdx !== -1) {
      rawNodeId = rawNodeId.slice(0, lastDashIdx);
    }
    
    const matchedNode = graphData?.nodes.find(n => 
      n.id.replace(/:/g, "_") === rawNodeId || n.id === rawNodeId
    );
    
    if (matchedNode) {
      setSelectedNodeId(matchedNode.id);
    }
  };

  // Fetch live graph structure from LangGraph API
  useEffect(() => {
    if (!isOpen || !assistantId || !apiUrl) return;
    
    const fetchGraph = async () => {
      try {
        const headers: Record<string, string> = {};
        const localApiKey = typeof window !== "undefined" ? window.localStorage.getItem("lg:chat:apiKey") || null : null;
        const localAuthScheme = typeof window !== "undefined" ? window.localStorage.getItem("lg:chat:authScheme") || null : null;
        
        if (localApiKey) headers["X-Api-Key"] = localApiKey;
        if (localAuthScheme) headers["X-Auth-Scheme"] = localAuthScheme;

        const res = await fetch(`${apiUrl}/assistants/${assistantId}/graph?xray=true`, {
          headers
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.nodes && data.edges) {
            setGraphData(data);
          }
        }
      } catch (err) {
        console.error("Failed to fetch graph:", err);
      }
    };

    fetchGraph();
  }, [isOpen, assistantId, apiUrl]);

  // Fetch thread history checkpoints from LangGraph API
  useEffect(() => {
    if (!isOpen || !threadId || !apiUrl) return;
    
    const fetchHistory = async () => {
      try {
        const client = createClient(
          apiUrl,
          typeof window !== "undefined" ? window.localStorage.getItem("lg:chat:apiKey") || undefined : undefined,
          typeof window !== "undefined" ? window.localStorage.getItem("lg:chat:authScheme") || undefined : undefined
        );
        const res = await client.threads.getHistory(threadId, { limit: 50 });
        setHistory(res);
      } catch (err) {
        console.error("Failed to fetch thread history:", err);
      }
    };

    fetchHistory();

    let intervalId: any;
    if (isLoading) {
      intervalId = setInterval(fetchHistory, 2000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isOpen, threadId, apiUrl, allMessages.length, isLoading]);



  // Compile Mermaid into SVG HTML
  useEffect(() => {
    if (typeof window === "undefined" || !graphData) return;
    
    let highlightNodeId = activeNodeId;
    const isHighlightMode = (!!selectedCheckpointId && !isHighlightBypassed) || isLoading;
    
    if (isHighlightMode) {
      if (selectedCheckpointId && !isHighlightBypassed && history.length > 0) {
        const selectedCp = history.find(
          (c) => c.checkpoint_id === selectedCheckpointId || c.config?.configurable?.checkpoint_id === selectedCheckpointId
        );
        if (selectedCp) {
          highlightNodeId = getActiveNodeForCheckpoint(selectedCp);
        }
      } else {
        highlightNodeId = activeNodeId;
      }
    }

    const chartString = generateMermaidChart(graphData.nodes, graphData.edges, highlightNodeId, isHighlightMode);
    
    import("mermaid").then(async (m) => {
      try {
        m.default.initialize({ 
          startOnLoad: false, 
          theme: "base",
          securityLevel: "loose",
          htmlLabels: true, // Enable HTML labels rendering in nodes
          themeVariables: {
            background: "transparent",
            mainBkg: "#ffffff",
            primaryColor: "#ffffff",
            primaryTextColor: "#334155",
            primaryBorderColor: "#cbd5e1",
            lineColor: "#64748b"
          }
        });
        const uniqueId = `mermaid-svg-${Date.now()}`;
        const { svg } = await m.default.render(uniqueId, chartString);
        setSvgHtml(svg);
      } catch (err) {
        console.error("Mermaid render error:", err);
      }
    });
  }, [graphData, activeNodeId, selectedCheckpointId, history, isHighlightBypassed, isLoading]);

  // Trace back history checkpoints to map the triggered nodes timeline
  const steps = useMemo(() => {
    if (!history || history.length === 0) {
      if (!message) return [];
      
      const fallbackSteps: any[] = [];
      const textContent = getContentString(message.content || "");
      const toolCalls = message.tool_calls || [];
      
      fallbackSteps.push({
        id: "fallback-before-run",
        title: "Node: before_run (System Init)",
        subtitle: "Configured graph variables",
        timestamp: "00:00:01 AM",
        status: "completed"
      });
      
      fallbackSteps.push({
        id: "fallback-human",
        title: "Node: human (User Request)",
        subtitle: "Received user prompt",
        timestamp: "00:00:02 AM",
        status: "completed"
      });

      toolCalls.forEach((tc: any, index: number) => {
        const toolMsg = allMessages.find(
          (m: any) => m.type === "tool" && m.tool_call_id === tc.id
        );
        
        const friendlyName = tc.name || "Tool Call";
        
        fallbackSteps.push({
          id: `fallback-model-${index}`,
          title: "Node: agent:model (LLM Decision)",
          subtitle: `Called tools: ${friendlyName}`,
          timestamp: `00:00:0${3 + index * 2} AM`,
          status: "completed",
          thought: textContent || undefined,
          action: `${friendlyName}(${Object.entries(tc.args || {}).map(([k,v]) => `${k}=${JSON.stringify(v)}`).join(", ")})`
        });

        if (toolMsg) {
          fallbackSteps.push({
            id: `fallback-tools-${index}`,
            title: "Node: agent:tools (Tool Execution)",
            subtitle: "Returned result from executed tool",
            timestamp: `00:00:0${4 + index * 2} AM`,
            status: "completed",
            observation: typeof toolMsg.content === "string" ? toolMsg.content : JSON.stringify(toolMsg.content, null, 2)
          });
        }
      });

      if (toolCalls.length === 0) {
        fallbackSteps.push({
          id: "fallback-model-direct",
          title: "Node: agent:model (LLM Decision)",
          subtitle: "Generated response text",
          timestamp: "00:00:03 AM",
          status: "completed",
          thought: textContent
        });
      }

      if (streamInterrupt) {
        fallbackSteps.push({
          id: "fallback-pending",
          title: "Node: human",
          subtitle: "Awaiting intervention / confirmation",
          timestamp: "Pending",
          status: "pending"
        });
      }

      return fallbackSteps;
    }
    
    // Sort chronologically (oldest first)
    const sortedHistory = [...history].reverse();
    
    // Filter history up to the selected checkpoint
    let targetCheckpoints = sortedHistory;
    if (selectedCheckpointId) {
      const targetIdx = sortedHistory.findIndex(
        c => c.config?.configurable?.checkpoint_id === selectedCheckpointId || c.checkpoint_id === selectedCheckpointId
      );
      if (targetIdx !== -1) {
        targetCheckpoints = sortedHistory.slice(0, targetIdx + 1);
      }
    }

    const stepsList: any[] = [];
    
    targetCheckpoints.forEach((checkpoint, index) => {
      const tasks = checkpoint.tasks || [];
      const writes = checkpoint.metadata?.writes || {};
      
      const timeStr = checkpoint.created_at 
        ? new Date(checkpoint.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : "Active";
      // 1. Process tasks if they exist
      if (tasks.length > 0) {
        tasks.forEach((task: any, tIdx: number) => {
          const nodeName = task.name || "agent";
          let title = `Node: ${nodeName}`;
          let subtitle = `State update completed`;
          let thought = "";
          let action = "";
          let observation = "";
          let response = "";

          const taskMsgSource = task.result?.messages || task.result || [];
          const messagesArray = Array.isArray(taskMsgSource) ? taskMsgSource : [taskMsgSource];
          
          // Filter to only new messages produced in this checkpoint
          const parentCp = sortedHistory.find(c => c.checkpoint_id === checkpoint.parent_checkpoint_id);
          const parentMsgIds = new Set(
            (parentCp?.values?.messages || []).map((m: any) => m.id).filter(Boolean)
          );
          let newMessages = messagesArray.filter((m: any) => m && (!m.id || !parentMsgIds.has(m.id)));
          if (newMessages.length === 0 && messagesArray.length > 0) {
            newMessages = [messagesArray[messagesArray.length - 1]];
          }

          newMessages.forEach((msg: any) => {
            if (!msg) return;
            if (msg.type === "ai") {
              title = `Node: ${nodeName} (LLM Decision)`;
              const textContent = getContentString(msg.content || "");
              const toolCalls = parseToolCalls(msg);
              if (msg.additional_kwargs?.reasoning_content) {
                const currentThought = msg.additional_kwargs.reasoning_content;
                thought = thought ? `${thought}\n\n${currentThought}` : currentThought;
                response = response ? `${response}\n\n${textContent}` : textContent;
              } else if (toolCalls && toolCalls.length > 0) {
                const currentThought = textContent;
                if (currentThought) {
                  thought = thought ? `${thought}\n\n${currentThought}` : currentThought;
                }
                const currentAction = toolCalls.map((tc: any) => `${tc.name}(${Object.entries(tc.args || {}).map(([k,v]) => `${k}=${JSON.stringify(v)}`).join(", ")})`).join("\n");
                action = action ? `${action}\n\n${currentAction}` : currentAction;
                subtitle = subtitle && subtitle.includes("Called tools") 
                  ? `${subtitle}, ${toolCalls.map((tc: any) => tc.name).join(", ")}`
                  : `Called tools: ${toolCalls.map((tc: any) => tc.name).join(", ")}`;
              } else {
                response = response ? `${response}\n\n${textContent}` : textContent;
                subtitle = `Generated response text`;
              }
            } else if (msg.type === "tool") {
              title = `Node: ${nodeName} (Tool Execution)`;
              
              // Find matching tool call in allMessages to display the action
              const matchedToolCall = allMessages
                .filter((m: any) => m && m.type === "ai")
                .flatMap((m: any) => parseToolCalls(m))
                .find((tc: any) => tc && tc.id === msg.tool_call_id);
              
              if (matchedToolCall) {
                const currentAction = `${matchedToolCall.name}(${Object.entries(matchedToolCall.args || {}).map(([k,v]) => `${k}=${JSON.stringify(v)}`).join(", ")})`;
                action = action ? `${action}\n\n${currentAction}` : currentAction;
              }

              const toolName = msg.name ? `[${msg.name}]` : (matchedToolCall?.name ? `[${matchedToolCall.name}]` : "");
              const currentObs = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content, null, 2);
              observation = observation 
                ? `${observation}\n\n${toolName} Response:\n${currentObs}` 
                : `${toolName} Response:\n${currentObs}`;
              subtitle = subtitle && subtitle.includes("Returned result")
                ? `Returned results from executed tools`
                : `Returned result from executed tool`;
            } else if (msg.type === "human") {
              title = `Node: human (User Request)`;
              subtitle = `Received: "${getContentString(msg.content || "")}"`;
            }
          });

          stepsList.push({
            id: task.id || `${checkpoint.checkpoint_id || checkpoint.config?.configurable?.checkpoint_id}-${nodeName}-${tIdx}`,
            title,
            subtitle,
            timestamp: timeStr,
            status: "completed",
            thought: thought || undefined,
            action: action || undefined,
            observation: observation || undefined,
            response: response || undefined,
            checkpointId: checkpoint.checkpoint_id || checkpoint.config?.configurable?.checkpoint_id || "",
            parentCheckpointId: checkpoint.parent_checkpoint_id || checkpoint.parent_config?.configurable?.checkpoint_id || "",
            taskId: task.id || "",
            messageId: newMessages.map((m: any) => m.id).filter(Boolean).join(", ") || ""
          });
        });
      } 
      // 2. Fallback to metadata writes if tasks is empty
      else if (Object.keys(writes).length > 0) {
        Object.keys(writes).forEach((nodeName, wIdx) => {
          if (nodeName === "__tasks__" || nodeName === "__received__") return;
          
          const nodeWriteValue = writes[nodeName];
          let title = `Node: ${nodeName}`;
          let subtitle = `State update completed`;
          let thought = "";
          let action = "";
          let observation = "";
          let response = "";

          const writesMsgSource = nodeWriteValue?.messages || nodeWriteValue;
          const messagesArray = Array.isArray(writesMsgSource) ? writesMsgSource : [writesMsgSource];

          // Filter to only new messages produced in this checkpoint
          const parentCp = sortedHistory.find(c => c.checkpoint_id === checkpoint.parent_checkpoint_id);
          const parentMsgIds = new Set(
            (parentCp?.values?.messages || []).map((m: any) => m.id).filter(Boolean)
          );
          let newMessages = messagesArray.filter((m: any) => m && (!m.id || !parentMsgIds.has(m.id)));
          if (newMessages.length === 0 && messagesArray.length > 0) {
            newMessages = [messagesArray[messagesArray.length - 1]];
          }

          newMessages.forEach((msg: any) => {
            if (!msg) return;
            if (msg.type === "ai") {
              title = `Node: ${nodeName} (LLM Decision)`;
              const textContent = getContentString(msg.content || "");
              const toolCalls = parseToolCalls(msg);
              if (msg.additional_kwargs?.reasoning_content) {
                const currentThought = msg.additional_kwargs.reasoning_content;
                thought = thought ? `${thought}\n\n${currentThought}` : currentThought;
                response = response ? `${response}\n\n${textContent}` : textContent;
              } else if (toolCalls && toolCalls.length > 0) {
                const currentThought = textContent;
                if (currentThought) {
                  thought = thought ? `${thought}\n\n${currentThought}` : currentThought;
                }
                const currentAction = toolCalls.map((tc: any) => `${tc.name}(${Object.entries(tc.args || {}).map(([k,v]) => `${k}=${JSON.stringify(v)}`).join(", ")})`).join("\n");
                action = action ? `${action}\n\n${currentAction}` : currentAction;
                subtitle = subtitle && subtitle.includes("Called tools") 
                  ? `${subtitle}, ${toolCalls.map((tc: any) => tc.name).join(", ")}`
                  : `Called tools: ${toolCalls.map((tc: any) => tc.name).join(", ")}`;
              } else {
                response = response ? `${response}\n\n${textContent}` : textContent;
                subtitle = `Generated response text`;
              }
            } else if (msg.type === "tool") {
              title = `Node: ${nodeName} (Tool Execution)`;
              
              // Find matching tool call in allMessages to display the action
              const matchedToolCall = allMessages
                .filter((m: any) => m && m.type === "ai")
                .flatMap((m: any) => parseToolCalls(m))
                .find((tc: any) => tc && tc.id === msg.tool_call_id);
              
              if (matchedToolCall) {
                const currentAction = `${matchedToolCall.name}(${Object.entries(matchedToolCall.args || {}).map(([k,v]) => `${k}=${JSON.stringify(v)}`).join(", ")})`;
                action = action ? `${action}\n\n${currentAction}` : currentAction;
              }

              const toolName = msg.name ? `[${msg.name}]` : (matchedToolCall?.name ? `[${matchedToolCall.name}]` : "");
              const currentObs = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content, null, 2);
              observation = observation 
                ? `${observation}\n\n${toolName} Response:\n${currentObs}` 
                : `${toolName} Response:\n${currentObs}`;
              subtitle = subtitle && subtitle.includes("Returned result")
                ? `Returned results from executed tools`
                : `Returned result from executed tool`;
            } else if (msg.type === "human") {
              title = `Node: human (User Request)`;
              subtitle = `Received: "${getContentString(msg.content || "")}"`;
            }
          });

          stepsList.push({
            id: `${checkpoint.checkpoint_id || checkpoint.config?.configurable?.checkpoint_id}-${nodeName}-${wIdx}`,
            title,
            subtitle,
            timestamp: timeStr,
            status: "completed",
            thought: thought || undefined,
            action: action || undefined,
            observation: observation || undefined,
            response: response || undefined,
            checkpointId: checkpoint.checkpoint_id || checkpoint.config?.configurable?.checkpoint_id || "",
            parentCheckpointId: checkpoint.parent_checkpoint_id || checkpoint.parent_config?.configurable?.checkpoint_id || "",
            taskId: "",
            messageId: newMessages.map((m: any) => m.id).filter(Boolean).join(", ") || ""
          });
        });
      }
    });

    if (isLoading && stepsList.length > 0) {
        stepsList.push({
          id: "step-running",
          title: "Node: agent:model",
          subtitle: "Running LLM inference choice...",
          timestamp: "Running",
          status: "running"
        });
      }

    if (streamInterrupt) {
      stepsList.push({
        id: "step-pending",
        title: "Node: human",
        subtitle: "Awaiting intervention / confirmation",
        timestamp: "Pending",
        status: "pending"
      });
    }

    return stepsList.map((step, idx) => {
      const rawTitle = step.title.replace(/^Node:\s*/, "");
      return {
        ...step,
        title: `Step ${idx + 1}: ${rawTitle}`
      };
    });
  }, [history, selectedCheckpointId, isLoading, streamInterrupt, allMessages]);

  // Auto scroll to bottom when Flow tab is active or steps change
  useEffect(() => {
    if (activeTab === "flow" && flowScrollRef.current) {
      flowScrollRef.current.scrollTop = flowScrollRef.current.scrollHeight;
    }
  }, [activeTab, steps, isOpen]);

  const handleStepClick = (step: any) => {
    setSelectedStepId(step.id === selectedStepId ? null : step.id);
    
    const firstMsgId = step.messageId ? step.messageId.split(",")[0].trim() : null;
    if (firstMsgId) {
      const element = document.getElementById(`msg-${firstMsgId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        // Add highlight styling classes
        element.classList.add("ring-2", "ring-indigo-500/80", "ring-offset-2", "bg-indigo-50/10");
        setTimeout(() => {
          element.classList.remove("ring-2", "ring-indigo-500/80", "ring-offset-2", "bg-indigo-50/10");
        }, 2000);
      }
    }
  };

  if (!isOpen || !message) return null;

  return (
    <div
      ref={setPanelRef}
      style={{ width: `${width}px` }}
      className="fixed z-50 right-0 top-0 h-screen bg-white border-l border-slate-200 shadow-2xl flex flex-col"
    >
      <div 
        onMouseDown={handleMouseDown}
        className="absolute left-0 top-0 w-2 h-full cursor-ew-resize hover:bg-indigo-500/10 active:bg-indigo-600/30 transition-colors z-50"
      />
      {/* Header bar */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-50 p-1.5 rounded-lg text-indigo-600">
            <Network className="size-4" />
          </div>
          <span className="font-bold text-slate-800 text-sm">Agent Workflow</span>
          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 rounded-full px-2 py-0.5 text-[10px] font-semibold border border-emerald-100">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            LIVE
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-slate-500 hover:bg-slate-200 rounded-lg"
            onClick={() => setWidth(prev => prev >= windowWidth - 80 ? 420 : windowWidth)}
          >
            {width >= windowWidth - 80 ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-slate-500 hover:bg-slate-200 rounded-lg"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between select-none shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("flow")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200",
              activeTab === "flow" 
                ? "bg-indigo-600 text-white shadow-sm" 
                : "text-slate-6/65 hover:bg-slate-200/60"
            )}
          >
            Steps
          </button>
          {!isGraphUndocked && (
            <button
              onClick={() => setActiveTab("graph")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200",
                activeTab === "graph" 
                  ? "bg-indigo-600 text-white shadow-sm" 
                  : "text-slate-6/65 hover:bg-slate-200/60"
              )}
            >
              Graph
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (isGraphUndocked) {
                setIsGraphUndocked(false);
                setActiveTab("graph");
              } else {
                setIsGraphUndocked(true);
                setActiveTab("flow");
              }
            }}
            className="text-[10px] font-bold flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-all shadow-3xs"
          >
            {isGraphUndocked ? (
              <>
                <Anchor className="size-3" />
                Dock Graph
              </>
            ) : (
              <>
                <ExternalLink className="size-3" />
                Undock Graph
              </>
            )}
          </button>
        </div>
      </div>

      {activeTab === "graph" ? (
        /* Node Graph Visualization */
        <div className="flex-1 min-h-0 bg-white text-slate-800 relative select-none overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing">
          {selectedCheckpointId && !isHighlightBypassed && (
            <div className="absolute bottom-4 left-4 z-30 pointer-events-auto">
              <button
                onClick={() => setIsHighlightBypassed(true)}
                className="text-[10px] font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-indigo-200 bg-white hover:bg-slate-50 text-indigo-600 transition-all shadow-md active:scale-95"
                title="Reset highlight to light up all nodes"
              >
                <Sun className="size-3 animate-spin-slow" />
                Reset Highlight
              </button>
            </div>
          )}
          
          
          <motion.div
            key={`graph-${resetKey}`}
            drag
            dragMomentum={true}
            className="z-10 flex-shrink-0 flex items-center justify-center pointer-events-auto"
            style={{ 
              width: "1200px", 
              height: "1200px",
              transformOrigin: "center center"
            }}
          >
            <div 
              onClick={handleSvgClick}
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: "center center"
              }}
              className="[&>svg]:max-w-none [&>svg]:h-auto flex items-center justify-center cursor-pointer"
              dangerouslySetInnerHTML={{ __html: svgHtml || '<div class="text-xs text-slate-500 py-6">Compiling graph diagram...</div>' }}
            />
          </motion.div>

          {selectedNodeId && (
            <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md border border-slate-200 shadow-lg rounded-xl p-3 z-20 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex flex-col gap-0.5 pointer-events-auto select-text text-left">
                <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider">Node Selected</span>
                <h5 className="text-xs font-bold text-slate-800">{selectedNodeId}</h5>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                  {selectedNodeId === "__start__" && "Initial execution entry point."}
                  {selectedNodeId === "before_run" && "Initializes session variables and states."}
                  {selectedNodeId === "agent:model" && "LLM reasoning and tool call choice node."}
                  {selectedNodeId === "agent:tools" && "Executes requested tool actions."}
                  {selectedNodeId === "agent:save_thread.after_model" && "Saves checkpoint state after LLM decision."}
                  {selectedNodeId === "human" && "Awaiting human-in-the-loop intervention."}
                  {selectedNodeId === "__end__" && "Execution path terminal node."}
                </p>
              </div>
              <div className="flex gap-2 pointer-events-auto shrink-0 ml-4">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-[10px] h-7 px-2.5 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50"
                  onClick={() => setSelectedNodeId(null)}
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  className="text-[10px] h-7 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white animate-pulse"
                  onClick={() => {
                    const flowStep = steps.find(s => 
                      s.title.toLowerCase().includes(selectedNodeId.toLowerCase()) || 
                      (selectedNodeId === "agent:model" && s.title.includes("model")) ||
                      (selectedNodeId === "agent:tools" && s.title.includes("tools"))
                    );
                    setActiveTab("flow");
                    if (flowStep) {
                      setSelectedStepId(flowStep.id);
                    }
                  }}
                >
                  View Detail
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Main Content Area (Canvas Viewport) */
        <div 
          ref={flowScrollRef}
          className="flex-1 min-h-0 overflow-y-auto bg-slate-50/50 relative select-text flex justify-center scroll-smooth [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200 hover:[&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent"
        >
          <div 
            className="flex-shrink-0 flex flex-col items-center pointer-events-auto py-8"
            style={{ 
              width: `${Math.max(300, Math.round(400 * (zoom / 100)))}px`
            }}
          >
            <div 
              style={{ 
                width: "100%",
                gap: `${Math.max(12, Math.round(24 * (zoom / 100)))}px`
              }}
              className="flex flex-col max-w-full"
            >
              {steps.map((step, idx) => {
                const isCompleted = step.status === "completed";
                const isRunning = step.status === "running";
                const isPending = step.status === "pending";
                const isExpandedCard = isRunning || (isCompleted && (step.action || step.thought || step.observation || step.response));

                const currentGap = Math.max(12, Math.round(24 * (zoom / 100)));

                return (
                  <div key={step.id} className="relative flex flex-col items-center w-full">
                    {idx > 0 && (
                      <div 
                        style={{ height: `${currentGap}px` }}
                        className="absolute bottom-full w-px bg-slate-200" 
                      />
                    )}
                    
                    <div 
                      onClick={() => handleStepClick(step)}
                      style={{ 
                        padding: `${Math.max(8, Math.round(16 * (zoom / 100)))}px`,
                        borderRadius: `${Math.max(8, Math.round(16 * (zoom / 100)))}px`,
                        gap: `${Math.max(6, Math.round(12 * (zoom / 100)))}px`
                      }}
                      className={cn(
                        "w-full border bg-white transition-all duration-200 flex flex-col cursor-pointer select-none",
                        selectedStepId === step.id && "border-indigo-600 ring-2 ring-indigo-600/20 shadow-md",
                        (selectedStepId !== step.id && isExpandedCard) && "border-blue-500 shadow-md ring-1 ring-blue-500/10",
                        (selectedStepId !== step.id && !isExpandedCard) && "border-slate-100 shadow-2xs",
                        isPending && "border-dashed opacity-60 bg-slate-50/50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col gap-0.5 text-left">
                          <span 
                            style={{ fontSize: `${Math.max(8, Math.round(9 * (zoom / 100)))}px` }}
                            className="font-semibold text-slate-400 font-mono"
                          >
                            {step.timestamp}
                          </span>
                          <h4 
                            style={{ fontSize: `${Math.max(10, Math.round(12 * (zoom / 100)))}px` }}
                            className={cn("font-bold text-slate-800", isPending && "text-slate-400")}
                          >
                            {step.title}
                          </h4>
                          <p 
                            style={{ fontSize: `${Math.max(8, Math.round(10 * (zoom / 100)))}px` }}
                            className="text-slate-500 font-normal mt-0.5"
                          >
                            {step.subtitle}
                          </p>
                        </div>
                        {isCompleted && (
                          <CheckCircle2 
                            style={{ width: `${Math.max(12, Math.round(16 * (zoom / 100)))}px`, height: `${Math.max(12, Math.round(16 * (zoom / 100)))}px` }}
                            className="text-emerald-500 flex-shrink-0" 
                          />
                        )}
                        {isRunning && (
                          <Loader2 
                            style={{ width: `${Math.max(12, Math.round(16 * (zoom / 100)))}px`, height: `${Math.max(12, Math.round(16 * (zoom / 100)))}px` }}
                            className="text-blue-500 animate-spin flex-shrink-0" 
                          />
                        )}
                        {isPending && (
                          <Hourglass 
                            style={{ width: `${Math.max(12, Math.round(16 * (zoom / 100)))}px`, height: `${Math.max(12, Math.round(16 * (zoom / 100)))}px` }}
                            className="text-slate-400 flex-shrink-0" 
                          />
                        )}
                      </div>

                      {isExpandedCard && (
                        <div 
                          style={{ 
                            gap: `${Math.max(6, Math.round(12 * (zoom / 100)))}px`,
                            marginTop: `${Math.max(4, Math.round(8 * (zoom / 100)))}px`,
                            paddingTop: `${Math.max(6, Math.round(12 * (zoom / 100)))}px`
                          }}
                          className="flex flex-col border-t border-slate-100"
                        >
                          {step.thought && (
                            <div 
                              style={{ 
                                padding: `${Math.max(6, Math.round(12 * (zoom / 100)))}px`,
                                borderRadius: `${Math.max(6, Math.round(12 * (zoom / 100)))}px`,
                                gap: `${Math.max(4, Math.round(6 * (zoom / 100)))}px`
                              }}
                              className="bg-blue-50/30 border border-blue-100/60 flex flex-col text-left"
                            >
                              <div 
                                style={{ fontSize: `${Math.max(8, Math.round(9 * (zoom / 100)))}px`, gap: `${Math.max(4, Math.round(6 * (zoom / 100)))}px` }}
                                className="flex items-center font-bold text-blue-500 uppercase tracking-wider"
                              >
                                <Brain style={{ width: `${Math.max(10, Math.round(14 * (zoom / 100)))}px`, height: `${Math.max(10, Math.round(14 * (zoom / 100)))}px` }} />
                                Thought
                              </div>
                              <p 
                                style={{ fontSize: `${Math.max(9, Math.round(11 * (zoom / 100)))}px` }}
                                className="text-blue-900 font-normal leading-relaxed line-clamp-2"
                              >
                                {step.thought}
                              </p>
                            </div>
                          )}

                          {step.response && (
                            <div 
                              style={{ 
                                padding: `${Math.max(6, Math.round(12 * (zoom / 100)))}px`,
                                borderRadius: `${Math.max(6, Math.round(12 * (zoom / 100)))}px`,
                                gap: `${Math.max(4, Math.round(6 * (zoom / 100)))}px`
                              }}
                              className="bg-indigo-50/30 border border-indigo-100/60 flex flex-col text-left"
                            >
                              <div 
                                style={{ fontSize: `${Math.max(8, Math.round(9 * (zoom / 100)))}px`, gap: `${Math.max(4, Math.round(6 * (zoom / 100)))}px` }}
                                className="flex items-center font-bold text-indigo-500 uppercase tracking-wider"
                              >
                                <Network style={{ width: `${Math.max(10, Math.round(14 * (zoom / 100)))}px`, height: `${Math.max(10, Math.round(14 * (zoom / 100)))}px` }} />
                                Response
                              </div>
                              <p 
                                style={{ fontSize: `${Math.max(9, Math.round(11 * (zoom / 100)))}px` }}
                                className="text-indigo-950 font-normal leading-relaxed line-clamp-2"
                              >
                                {step.response}
                              </p>
                            </div>
                          )}

                          {step.action && (
                            <div 
                              style={{ 
                                padding: `${Math.max(6, Math.round(12 * (zoom / 100)))}px`,
                                borderRadius: `${Math.max(6, Math.round(12 * (zoom / 100)))}px`,
                                gap: `${Math.max(4, Math.round(6 * (zoom / 100)))}px`
                              }}
                              className="bg-emerald-50/30 border border-emerald-100/60 flex flex-col text-left"
                            >
                              <div 
                                style={{ fontSize: `${Math.max(8, Math.round(9 * (zoom / 100)))}px`, gap: `${Math.max(4, Math.round(6 * (zoom / 100)))}px` }}
                                className="flex items-center font-bold text-emerald-500 uppercase tracking-wider"
                              >
                                <Zap style={{ width: `${Math.max(10, Math.round(14 * (zoom / 100)))}px`, height: `${Math.max(10, Math.round(14 * (zoom / 100)))}px` }} />
                                Action
                              </div>
                              <code 
                                style={{ fontSize: `${Math.max(8, Math.round(10 * (zoom / 100)))}px`, padding: `${Math.max(4, Math.round(6 * (zoom / 100)))}px` }}
                                className="text-emerald-800 font-mono break-all bg-emerald-50/20 rounded-lg block whitespace-pre-wrap line-clamp-1"
                              >
                                {step.action}
                              </code>
                            </div>
                          )}

                          {step.observation && (
                            <div 
                              style={{ 
                                padding: `${Math.max(6, Math.round(12 * (zoom / 100)))}px`,
                                borderRadius: `${Math.max(6, Math.round(12 * (zoom / 100)))}px`,
                                gap: `${Math.max(4, Math.round(6 * (zoom / 100)))}px`
                              }}
                              className="bg-slate-50 border border-slate-200/60 flex flex-col text-left"
                            >
                              <div 
                                style={{ fontSize: `${Math.max(8, Math.round(9 * (zoom / 100)))}px`, gap: `${Math.max(4, Math.round(6 * (zoom / 100)))}px` }}
                                className="flex items-center font-bold text-slate-500 uppercase tracking-wider"
                              >
                                <Eye style={{ width: `${Math.max(10, Math.round(14 * (zoom / 100)))}px`, height: `${Math.max(10, Math.round(14 * (zoom / 100)))}px` }} />
                                Observation
                              </div>
                              <pre 
                                style={{ fontSize: `${Math.max(8, Math.round(10 * (zoom / 100)))}px` }}
                                className="text-slate-600 font-mono break-all whitespace-pre-wrap line-clamp-2 overflow-hidden"
                              >
                                {step.observation}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                      {/* View Detail button inside Flow card */}
                      {(step.thought || step.action || step.observation || step.response) && (
                        <div 
                          style={{ 
                            marginTop: `${Math.max(4, Math.round(8 * (zoom / 100)))}px`,
                            paddingTop: `${Math.max(4, Math.round(8 * (zoom / 100)))}px`
                          }}
                          className="flex justify-end border-t border-slate-100/60 pointer-events-auto"
                        >
                          <Button
                            size="sm"
                            variant="ghost"
                            style={{ 
                              fontSize: `${Math.max(8, Math.round(10 * (zoom / 100)))}px`,
                              height: `${Math.max(22, Math.round(28 * (zoom / 100)))}px`,
                              paddingLeft: `${Math.max(6, Math.round(10 * (zoom / 100)))}px`,
                              paddingRight: `${Math.max(6, Math.round(10 * (zoom / 100)))}px`,
                              gap: `${Math.max(4, Math.round(6 * (zoom / 100)))}px`
                            }}
                            className="font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 rounded-lg flex items-center"
                            onClick={(e) => {
                              e.stopPropagation(); // Stop selection trigger
                              setDetailStep(step);
                            }}
                          >
                            <Eye style={{ width: `${Math.max(10, Math.round(12 * (zoom / 100)))}px`, height: `${Math.max(10, Math.round(12 * (zoom / 100)))}px` }} />
                            View Detail
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Floating Zoom Controls and Minimap */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 items-end z-10 pointer-events-none">


        <div className="bg-white border border-slate-200 shadow-md rounded-xl flex flex-col items-center overflow-hidden pointer-events-auto">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-slate-600 hover:bg-slate-100 rounded-none border-b border-slate-100"
            onClick={() => setZoom(prev => Math.min(prev + 10, 150))}
          >
            <Plus className="size-3.5" />
          </Button>
          <span className="text-[10px] font-bold text-slate-500 px-2 py-1 select-none">
            {zoom}%
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-slate-600 hover:bg-slate-100 rounded-none border-b border-slate-100"
            onClick={() => setZoom(prev => Math.max(prev - 10, 70))}
          >
            <Minus className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-slate-600 hover:bg-slate-100 rounded-none"
            onClick={() => {
              setZoom(100);
              setResetKey(prev => prev + 1);
            }}
            title="Reset Pan & Zoom"
          >
            <Maximize2 className="size-3.5" />
          </Button>
        </div>
      </div>
      {detailStep && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-[800px] bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 flex flex-col gap-4 max-h-[85vh] overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3 select-none">
              <div className="flex flex-col gap-1 text-left">
                <span className="text-xs font-semibold text-slate-400 font-mono">
                  {detailStep.timestamp}
                </span>
                <h4 className="text-base font-bold text-slate-800">
                  {detailStep.title}
                </h4>
                <p className="text-sm text-slate-500">
                  {detailStep.subtitle}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-slate-400 hover:bg-slate-100 rounded-md"
                onClick={() => setDetailStep(null)}
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 select-text text-left">
              {/* Step Identifiers card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex flex-col gap-2.5 text-xs text-slate-600 font-mono">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 select-none font-sans">Step Identifiers</span>
                {detailStep.checkpointId && (
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 gap-4">
                    <span className="text-slate-450 select-none">Checkpoint ID:</span>
                    <span className="text-slate-800 break-all select-all font-semibold text-right">{detailStep.checkpointId}</span>
                  </div>
                )}
                {detailStep.parentCheckpointId && (
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 gap-4">
                    <span className="text-slate-450 select-none">Parent ID:</span>
                    <span className="text-slate-800 break-all select-all text-right">{detailStep.parentCheckpointId}</span>
                  </div>
                )}
                {detailStep.taskId && (
                  <>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 gap-4">
                      <span className="text-slate-450 select-none">Task ID:</span>
                      <span className="text-slate-800 break-all select-all text-right">{detailStep.taskId}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 gap-4">
                      <span className="text-slate-450 select-none">LangSmith Trace:</span>
                      <a
                        href={`https://smith.langchain.com/o/b64b3846-9cc2-4137-ad53-8f4735598f0b/projects/p/69ff92cf-5a55-4515-8146-2b500039634d/r/${detailStep.taskId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-700 hover:underline break-all font-semibold text-right flex items-center gap-1 font-sans text-xs"
                      >
                        View in LangSmith
                        <ExternalLink className="size-3.5" />
                      </a>
                    </div>
                  </>
                )}
                {detailStep.messageId && (
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-1.5 last:border-none last:pb-0">
                    <span className="text-slate-450 select-none flex-shrink-0 mt-0.5">Message ID:</span>
                    <div className="text-slate-800 break-all select-all text-right flex flex-col items-end gap-1 flex-1 font-sans">
                      {detailStep.messageId.split(",").map((s: any) => s.trim()).filter(Boolean).length <= 1 ? (
                        <span className="font-mono text-xs">{detailStep.messageId}</span>
                      ) : (
                        <>
                          <span className="leading-relaxed font-mono text-xs">
                            {showMessageIdsExpanded 
                              ? detailStep.messageId 
                              : `${detailStep.messageId.split(",").map((s: any) => s.trim()).filter(Boolean)[0]}...`}
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowMessageIdsExpanded(!showMessageIdsExpanded)}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline select-none mt-0.5"
                          >
                            {showMessageIdsExpanded ? "Show Less" : `Show More (${detailStep.messageId.split(",").map((s: any) => s.trim()).filter(Boolean).length - 1} more)`}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {detailStep.thought && (
                <div className="bg-blue-50/40 border border-blue-100/60 rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-500 uppercase tracking-wider select-none">
                    <Brain className="size-4" />
                    Thought
                  </div>
                  <p className="text-sm text-blue-900 font-normal leading-relaxed whitespace-pre-wrap">
                    {detailStep.thought}
                  </p>
                </div>
              )}

              {detailStep.response && (
                <div className="bg-indigo-50/40 border border-indigo-100/60 rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-500 uppercase tracking-wider select-none">
                    <Network className="size-4" />
                    Response
                  </div>
                  <p className="text-sm text-indigo-950 font-normal leading-relaxed whitespace-pre-wrap">
                    {detailStep.response}
                  </p>
                </div>
              )}

              {detailStep.action && (
                <div className="bg-emerald-50/40 border border-emerald-100/60 rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-500 uppercase tracking-wider select-none">
                    <Zap className="size-4" />
                    Action
                  </div>
                  <code className="text-xs text-emerald-800 font-mono break-all bg-emerald-50/20 p-2.5 rounded-lg block whitespace-pre-wrap">
                    {detailStep.action}
                  </code>
                </div>
              )}

              {detailStep.observation && (
                <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">
                    <Eye className="size-4" />
                    Observation
                  </div>
                  <pre className="text-xs text-slate-600 font-mono break-all whitespace-pre-wrap bg-slate-100/30 p-2.5 rounded-lg block max-h-64 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
                    {detailStep.observation}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 pt-3 flex justify-end select-none">
              <Button
                size="default"
                className="bg-slate-800 hover:bg-slate-900 text-white rounded-xl px-5 text-sm h-9"
                onClick={() => setDetailStep(null)}
              >
                Close
              </Button>
            </div>
          </motion.div>
        </div>
      )}
       {isGraphUndocked && (
        <motion.div
          drag
          dragControls={dragControls}
          dragListener={false}
          dragMomentum={false}
          className="fixed z-50 bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden flex flex-col pointer-events-auto"
          style={{
            width: `${floatWidth}px`,
            height: `${floatHeight}px`,
            left: "40px",
            top: "100px",
          }}
        >
          {/* Title Bar acting as Drag Handle */}
          <div 
            onPointerDown={(e) => dragControls.start(e)}
            className="bg-slate-50 border-b border-slate-200 px-3.5 py-2.5 flex items-center justify-between cursor-move select-none shrink-0"
          >
            <div className="flex items-center gap-2">
              <Network className="size-3.5 text-indigo-600 animate-pulse" />
              <span className="font-bold text-slate-800 text-[11px] font-sans">Workflow Graph</span>
            </div>
             <button
              onClick={() => {
                setIsGraphUndocked(false);
                setActiveTab("graph");
              }}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              title="Dock Graph back"
            >
              <Minimize2 className="size-3.5" />
            </button>
          </div>

          {/* Graph Viewport */}
          <div ref={floatingViewportRef} className="flex-grow min-h-0 bg-white text-slate-800 relative select-none overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing">
            {selectedCheckpointId && !isHighlightBypassed && (
              <div className="absolute bottom-4 left-4 z-30 pointer-events-auto">
                <button
                  onClick={() => setIsHighlightBypassed(true)}
                  className="text-[10px] font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-indigo-200 bg-white hover:bg-slate-50 text-indigo-600 transition-all shadow-md active:scale-95"
                  title="Reset highlight to light up all nodes"
                >
                  <Sun className="size-3 animate-spin-slow" />
                  Reset Highlight
                </button>
              </div>
            )}
            <motion.div
              key={`undocked-graph-${resetKey}`}
              drag
              dragMomentum={true}
              className="z-10 flex-shrink-0 flex items-center justify-center pointer-events-auto"
              style={{ 
                width: "1200px", 
                height: "1200px",
                transformOrigin: "center center"
              }}
            >
              <div 
                onClick={handleSvgClick}
                style={{
                  transform: `scale(${((zoomGraph * 0.5) / 100) * (floatWidth / 380)})`,
                  transformOrigin: "center center"
                }}
                className="[&>svg]:max-w-none [&>svg]:h-auto flex items-center justify-center cursor-pointer"
                dangerouslySetInnerHTML={{ __html: svgHtml || '<div class="text-xs text-slate-500 py-6">Compiling graph diagram...</div>' }}
              />
            </motion.div>
          </div>
          
          {/* Resize Handle */}
          <div
            onMouseDown={startFloatResizing}
            className="absolute bottom-1 right-1 w-4 h-4 cursor-se-resize flex items-center justify-center z-50 select-none group"
            title="Resize window"
          >
            <svg 
              className="size-3.5 text-slate-300 hover:text-indigo-600 transition-colors" 
              viewBox="0 0 10 10" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.5"
            >
              <line x1="8" y1="2" x2="2" y2="8" strokeLinecap="round" />
              <line x1="8" y1="5" x2="5" y2="8" strokeLinecap="round" />
            </svg>
          </div>
        </motion.div>
      )}
    </div>
  );
}
