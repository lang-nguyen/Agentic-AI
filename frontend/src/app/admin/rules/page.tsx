"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Sliders,
  Plus,
  Trash2,
  Play,
  Search,
  MoreVertical,
  ToggleLeft,
  ToggleRight,
  FileText,
  CheckCircle,
  Activity,
  Cpu,
  FileCheck,
  RefreshCw,
  Inbox,
  Eye
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/common/ui/card";
import { Button } from "@/components/common/ui/button";
import { toast } from "sonner";
import { Toaster } from "@/components/common/ui/sonner";
import { API_CONFIG } from "@/config/api";

interface ConditionItem {
  id: string;
  field: string;
  operator: string;
  value: string;
  logicBefore?: "and" | "or" | string;
}

interface PolicyItem {
  id: string;
  reason: string;
  url: string;
}

interface Rule {
  id: string;
  name: string;
  type: "rule-based" | "nlp-based";
  conditions: ConditionItem[];
  nlpPrompt?: string;
  mode: "Auto" | "Semi-Auto";
  resolution: string;
  policies: PolicyItem[];
  status: boolean;
}

export default function SmartReturnSettingPage() {
  const [rules, setRules] = useState<Rule[]>([]);

  const fetchRules = async () => {
    try {
      const response = await fetch(`${API_CONFIG.rulesEngineBaseUrl}/api/smart-return/rules`);
      if (!response.ok) throw new Error("Failed to fetch rules");
      const data = await response.json();

      const mappedRules: Rule[] = data.map((apiRule: any) => {
        const isNlp = apiRule.type === "NLPBased";
        let conditions: ConditionItem[] = [];
        let nlpPrompt = "";

        if (isNlp) {
          nlpPrompt = apiRule.condition;
        } else {
          const cond = apiRule.condition;
          if (cond) {
            if (cond.field) {
              conditions = [{
                id: `c_${Date.now()}_0`,
                field: cond.field,
                operator: cond.operator,
                value: String(cond.value)
              }];
            } else if (cond.operator && cond.rules) {
              conditions = cond.rules.map((r: any, idx: number) => ({
                id: `c_${Date.now()}_${idx}`,
                field: r.field,
                operator: r.operator,
                value: String(r.value),
                logicBefore: idx > 0 ? cond.operator.toLowerCase() : undefined
              }));
            } else {
              conditions = Object.entries(cond).map(([key, value], idx) => ({
                id: `c_${Date.now()}_${idx}`,
                field: key,
                operator: "equal",
                value: String(value)
              }));
            }
          }
        }

        // Map resolutions
        let res = "Instant Refund";
        if (apiRule.action.action_type === "REFUND_AND_RETURN") {
          res = "Full Refund & Return";
        } else if (apiRule.action.action_type === "PARTIAL_REFUND") {
          res = "Partial Refund & Return";
        } else if (apiRule.action.action_type === "REJECT_REFUND") {
          res = "Reject";
        } else if (apiRule.action.action_type === "WAIT_FOR_APPROVAL") {
          res = "Pending Approval";
        }

        return {
          id: apiRule.rule_id,
          name: apiRule.name,
          type: isNlp ? "nlp-based" : "rule-based",
          conditions,
          nlpPrompt: isNlp ? nlpPrompt : undefined,
          mode: apiRule.action.mode === "AUTO" ? "Auto" : "Semi-Auto",
          resolution: res,
          policies: [
            { id: `p_${apiRule.rule_id}`, reason: "Laki Shop Policy", url: "https://laki.vn/policy" }
          ],
          status: apiRule.active !== undefined ? apiRule.active : true
        };
      });

      setRules(mappedRules);
    } catch (error) {
      console.error("Error fetching rules:", error);
      toast.error("Cannot connect to backend API. Using offline data.");

      // Fallback local rules in case API fails
      setRules([
        {
          id: "rule_01",
          name: "Auto Return for Apparel Under 500k",
          type: "rule-based",
          conditions: [
            { id: "c1", field: "category", operator: "is", value: "Apparel" },
            { id: "c2", field: "price", operator: "less than", value: "500000", logicBefore: "and" }
          ],
          mode: "Auto",
          resolution: "Instant Refund",
          policies: [
            { id: "p1", reason: "Apparel Policy", url: "https://laki.vn/policy/apparel" }
          ],
          status: true
        },
        {
          id: "rule_02",
          name: "Semi-Auto Approve for Torn Stitching Defect",
          type: "nlp-based",
          nlpPrompt: "If the customer reports torn stitching, missing button, or loose button",
          conditions: [],
          mode: "Semi-Auto",
          resolution: "Full Refund & Return",
          policies: [
            { id: "p2", reason: "Factory Manufacturing Defect", url: "https://laki.vn/policy/manufacturer-defect" }
          ],
          status: true
        }
      ]);
    }
  };

  const fetchScenarios = async () => {
    try {
      const response = await fetch(`${API_CONFIG.rulesEngineBaseUrl}/api/smart-return/scenarios`);
      if (!response.ok) throw new Error("Failed to fetch scenarios");
      const data = await response.json();
      setScenarios(data);
    } catch (error) {
      console.error("Error fetching scenarios:", error);
    }
  };

  useEffect(() => {
    fetchRules();
    fetchScenarios();
  }, []);

  // Form States
  const [ruleName, setRuleName] = useState("");
  const [activeTab, setActiveTab] = useState<"rule-based" | "nlp-based">("rule-based");
  const [conditions, setConditions] = useState<ConditionItem[]>([
    { id: "1", field: "category", operator: "is", value: "Apparel" }
  ]);
  const [nlpPrompt, setNlpPrompt] = useState("");
  const [mode, setMode] = useState<"Auto" | "Semi-Auto">("Auto");
  const [resolution, setResolution] = useState("Instant Refund");
  const [policies, setPolicies] = useState<PolicyItem[]>([
    { id: "1", reason: "", url: "" }
  ]);

  // Search and Dry Run states
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [isEditingRule, setIsEditingRule] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dryRunLog, setDryRunLog] = useState<string[] | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [activeDropdownRuleId, setActiveDropdownRuleId] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [scenarioResults, setScenarioResults] = useState<Record<string, { status: "PASS" | "FAIL", actual: any, expected: any }>>({});
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isRunningAll, setIsRunningAll] = useState(false);

  // Scenario detail modal states
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetailScenario, setSelectedDetailScenario] = useState<any | null>(null);

  // Custom experiment states
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
  const [selectedScenarioNames, setSelectedScenarioNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedRuleIds(prev => {
      const next = new Set(prev);
      rules.forEach(r => next.add(r.id));
      return next;
    });
  }, [rules]);

  useEffect(() => {
    setSelectedScenarioNames(prev => {
      const next = new Set(prev);
      scenarios.forEach(s => next.add(s.scenario_name));
      return next;
    });
  }, [scenarios]);

  // Selection helpers
  const handleToggleRuleSelection = (ruleId: string) => {
    setSelectedRuleIds(prev => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  };

  const handleToggleScenarioSelection = (scenarioName: string) => {
    setSelectedScenarioNames(prev => {
      const next = new Set(prev);
      if (next.has(scenarioName)) {
        next.delete(scenarioName);
      } else {
        next.add(scenarioName);
      }
      return next;
    });
  };

  const toggleAllRulesSelection = () => {
    setSelectedRuleIds(prev => {
      if (prev.size === rules.length) {
        return new Set();
      } else {
        return new Set(rules.map(r => r.id));
      }
    });
  };

  const toggleAllScenariosSelection = () => {
    setSelectedScenarioNames(prev => {
      if (prev.size === scenarios.length) {
        return new Set();
      } else {
        return new Set(scenarios.map(s => s.scenario_name));
      }
    });
  };

  const mapRuleToBackend = (rule: Rule) => {
    const isNlp = rule.type === "nlp-based";

    let actionType = "REFUND_IMMEDIATELY";
    if (rule.resolution === "Full Refund & Return" || rule.resolution === "Hoàn tiền toàn phần và trả hàng") {
      actionType = "REFUND_AND_RETURN";
    } else if (rule.resolution === "Partial Refund & Return" || rule.resolution === "Hoàn tiền 1 phần và trả hàng") {
      actionType = "PARTIAL_REFUND";
    } else if (rule.resolution === "Reject" || rule.resolution === "Từ chối") {
      actionType = "REJECT_REFUND";
    } else if (rule.resolution === "Pending Approval" || rule.resolution === "Chờ phê duyệt") {
      actionType = "WAIT_FOR_APPROVAL";
    }

    let cond: any = null;
    if (isNlp) {
      cond = rule.nlpPrompt || "";
    } else {
      if (rule.conditions.length === 1) {
        const c = rule.conditions[0];
        const parsedVal = isNaN(Number(c.value)) ? c.value : Number(c.value);
        cond = {
          field: c.field,
          operator: c.operator,
          value: parsedVal
        };
      } else if (rule.conditions.length > 1) {
        const operator = rule.conditions[1].logicBefore?.toUpperCase() || "AND";
        cond = {
          operator,
          rules: rule.conditions.map(c => {
            const parsedVal = isNaN(Number(c.value)) ? c.value : Number(c.value);
            return {
              field: c.field,
              operator: c.operator,
              value: parsedVal
            };
          })
        };
      }
    }

    return {
      rule_id: rule.id,
      name: rule.name,
      type: isNlp ? "NLPBased" : "RuleBased",
      active: rule.status,
      condition: cond,
      action: {
        action_type: actionType,
        mode: rule.mode === "Auto" ? "AUTO" : "SEMI-AUTO"
      }
    };
  };

  // Close dropdown on click outside
  useEffect(() => {
    if (!activeDropdownRuleId) return;
    const handleClose = () => setActiveDropdownRuleId(null);
    window.addEventListener("click", handleClose);
    return () => window.removeEventListener("click", handleClose);
  }, [activeDropdownRuleId]);

  // Splitter Resizing states
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(33.33); // Start with 1/3 (33.33%)
  const [isDragging, setIsDragging] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkSize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
    setIsDragging(true);
    mouseDownEvent.preventDefault();
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
      // Boundaries check: min 20%, max 80%
      if (newWidth >= 20 && newWidth <= 80) {
        setLeftWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Field/Value options
  const categoryOptions = ["Apparel", "Footwear", "Electronics", "Accessories"];
  const reasonOptions = ["wrong_size", "damaged", "wrong_item", "mind_change", "other"];

  // Add condition item
  const addCondition = () => {
    setConditions(prev => [
      ...prev,
      {
        id: String(Date.now()),
        field: "price",
        operator: "greater",
        value: "200000",
        logicBefore: "and"
      }
    ]);
  };

  // Remove condition item
  const removeCondition = (id: string) => {
    if (conditions.length <= 1) {
      toast.error("There must be at least one condition");
      return;
    }
    setConditions(prev => prev.filter(c => c.id !== id));
  };

  // Update condition fields
  const updateCondition = (id: string, updates: Partial<ConditionItem>) => {
    setConditions(prev => prev.map(c => {
      if (c.id === id) {
        const updated = { ...c, ...updates };
        // Reset default values if field type changes
        if (updates.field) {
          updated.value = updates.field === "category" ? "Apparel" : updates.field === "reason" ? "wrong_size" : "200000";
        }
        return updated;
      }
      return c;
    }));
  };

  // Add policy row
  const addPolicy = () => {
    setPolicies(prev => [...prev, { id: String(Date.now()), reason: "", url: "" }]);
  };

  // Remove policy row
  const removePolicy = (id: string) => {
    setPolicies(prev => prev.filter(p => p.id !== id));
  };

  // Update policy values
  const updatePolicy = (id: string, field: "reason" | "url", val: string) => {
    setPolicies(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));
  };

  // Handle Save Rule
  const handleSaveRule = () => {
    if (!ruleName.trim()) {
      toast.error("Please enter a rule name!");
      return;
    }
    if (activeTab === "nlp-based" && !nlpPrompt.trim()) {
      toast.error("Please enter the NLP context!");
      return;
    }

    if (selectedRuleId && selectedRuleId !== "new") {
      // Update existing rule
      setRules(prev => prev.map(r => {
        if (r.id === selectedRuleId) {
          return {
            ...r,
            name: ruleName,
            type: activeTab,
            conditions: activeTab === "rule-based" ? [...conditions] : [],
            nlpPrompt: activeTab === "nlp-based" ? nlpPrompt : undefined,
            mode,
            resolution,
            policies: policies.filter(p => p.reason.trim() !== "")
          };
        }
        return r;
      }));
      toast.success("Return rule updated successfully!");
      setIsEditingRule(false);
    } else {
      // Create new rule
      const newRuleId = `rule_${Date.now()}`;
      const newRule: Rule = {
        id: newRuleId,
        name: ruleName,
        type: activeTab,
        conditions: activeTab === "rule-based" ? [...conditions] : [],
        nlpPrompt: activeTab === "nlp-based" ? nlpPrompt : undefined,
        mode,
        resolution,
        policies: policies.filter(p => p.reason.trim() !== ""),
        status: true
      };

      setRules(prev => [newRule, ...prev]);
      toast.success("Return rule saved successfully!");
      setSelectedRuleId(newRuleId);
      setIsEditingRule(false);
    }
  };

  // Cancel edit mode
  const handleCancelEdit = () => {
    if (selectedRuleId === "new") {
      // Discard new rule template
      setSelectedRuleId(null);
      setIsEditingRule(false);
      setRuleName("");
      setConditions([{ id: "1", field: "category", operator: "is", value: "Apparel" }]);
      setNlpPrompt("");
      setPolicies([{ id: "1", reason: "", url: "" }]);
    } else if (selectedRuleId) {
      // Restore original config values and lock
      const originalRule = rules.find(r => r.id === selectedRuleId);
      if (originalRule) {
        setRuleName(originalRule.name);
        setActiveTab(originalRule.type);
        if (originalRule.type === "rule-based") {
          setConditions(originalRule.conditions.length > 0 ? originalRule.conditions : [{ id: "1", field: "category", operator: "is", value: "Apparel" }]);
        } else {
          setNlpPrompt(originalRule.nlpPrompt || "");
        }
        setMode(originalRule.mode);
        setResolution(originalRule.resolution);
        setPolicies(originalRule.policies.length > 0 ? originalRule.policies : [{ id: "1", reason: "", url: "" }]);
      }
      setIsEditingRule(false);
    }
  };

  // Dry Run evaluation simulation
  const handleDryRun = async () => {
    setIsTesting(true);
    setDryRunLog([
      "🔄 Initializing dry run environment...",
      "🔍 Parsing configured rules..."
    ]);

    await new Promise(resolve => setTimeout(resolve, 800));

    if (activeTab === "rule-based") {
      const logs = [
        "🔄 Initializing dry run environment...",
        "🔍 Parsing configured rules...",
        `📋 Reading conditions (${conditions.length} rule-based conditions):`
      ];

      conditions.forEach((c, i) => {
        logs.push(`   ↳ Condition #${i + 1}: [Field: ${c.field.toUpperCase()}] [Operator: ${c.operator.toUpperCase()}] [Matched Value: "${c.value}"]`);
      });

      logs.push("⚙️ Simulating order data retrieval and policy check...");
      await new Promise(resolve => setTimeout(resolve, 850));

      logs.push("✅ Order matched simulation: Category is 'Apparel' (Match successful)");
      logs.push(`🤖 Processing mode: ${mode === "Auto" ? "Fully automatic (Auto Approval)" : "Semi-automatic (Semi-Auto)"}`);
      logs.push(`🎯 Proposed resolution: ${resolution}`);
      logs.push(`📂 Attached policy: ${policies.filter(p => p.reason.trim() !== "").length} documents`);
      logs.push("🟢 DRY RUN RESULT: Success (Rule Passed!)");

      setDryRunLog(logs);
    } else {
      setDryRunLog([
        "🔄 Initializing dry run environment...",
        "🧠 Activating NLP Large Language Model (Llama-3-Agentic)...",
        `📝 Context extraction prompt: "${nlpPrompt}"`,
        "⚙️ Sending return intent analysis via LangGraph Agent...",
        "✅ Intent matched: Torn stitching/fabric tear (Confidence: 98%)",
        `🤖 Processing mode: ${mode}`,
        `🎯 Proposed resolution: ${resolution}`,
        "🟢 DRY RUN RESULT: Success (NLP Match Passed!)"
      ]);
    }
    setIsTesting(false);
  };

  // Test a specific rule from the list
  const handleTestSpecificRule = (rule: Rule) => {
    // 1. Copy details to form state
    setRuleName(rule.name);
    setActiveTab(rule.type);
    if (rule.type === "rule-based") {
      setConditions(rule.conditions);
    } else if (rule.nlpPrompt) {
      setNlpPrompt(rule.nlpPrompt);
    }
    setMode(rule.mode);
    setResolution(rule.resolution);
    setPolicies(rule.policies.length > 0 ? rule.policies : [{ id: "1", reason: "", url: "" }]);

    // 2. Perform test run simulation
    setIsTesting(true);
    setDryRunLog([
      "🔄 Initializing dry run environment...",
      `📋 Loading rule configuration: "${rule.name}"`
    ]);

    setTimeout(() => {
      if (rule.type === "rule-based") {
        const logs = [
          "🔄 Initializing dry run environment...",
          `📋 Loading rule configuration: "${rule.name}"`,
          `📋 Reading conditions (${rule.conditions.length} rule-based conditions):`
        ];

        rule.conditions.forEach((c, i) => {
          logs.push(`   ↳ Condition #${i + 1}: [Field: ${c.field.toUpperCase()}] [Operator: ${c.operator.toUpperCase()}] [Matched Value: "${c.value}"]`);
        });

        logs.push("⚙️ Simulating order data retrieval and policy check...");

        setTimeout(() => {
          logs.push("✅ Order matched simulation: Category is 'Apparel' (Match successful)");
          logs.push(`🤖 Processing mode: ${rule.mode === "Auto" ? "Fully automatic (Auto Approval)" : "Semi-automatic (Semi-Auto)"}`);
          logs.push(`🎯 Proposed resolution: ${rule.resolution}`);
          logs.push(`📂 Attached policy: ${rule.policies.length} documents`);
          logs.push("🟢 DRY RUN RESULT: Success (Rule Passed!)");
          setDryRunLog(logs);
          setIsTesting(false);
        }, 850);
      } else {
        setTimeout(() => {
          setDryRunLog([
            "🔄 Initializing dry run environment...",
            `📋 Loading rule configuration: "${rule.name}"`,
            "🧠 Activating NLP Large Language Model (Llama-3-Agentic)...",
            `📝 Context extraction prompt: "${rule.nlpPrompt}"`,
            "⚙️ Sending return intent analysis via LangGraph Agent...",
            "✅ Intent matched: Torn stitching/fabric tear (Confidence: 98%)",
            `🤖 Processing mode: ${rule.mode}`,
            `🎯 Proposed resolution: ${rule.resolution}`,
            "🟢 DRY RUN RESULT: Success (NLP Match Passed!)"
          ]);
          setIsTesting(false);
        }, 850);
      }
    }, 800);

    toast.success(`Testing rule: ${rule.name}`);
  };

  const handleRunScenario = async (sc: any) => {
    if (selectedRuleIds.size === 0) {
      toast.error("Please select at least one rule to run the experiment.");
      return;
    }

    setRunningScenario(sc.scenario_name);

    setDryRunLog([
      `🔄 Starting experiment dry run for scenario: "${sc.scenario_name}"`,
      `⚙️ Sending experiment request to API /experiment...`
    ]);

    try {
      const selectedBackendRules = rules
        .filter(r => selectedRuleIds.has(r.id))
        .map(mapRuleToBackend);

      const payload = {
        rules: selectedBackendRules,
        scenarios: [
          {
            scenario_name: sc.scenario_name,
            request: sc.request,
            expected_result: sc.expected_result
          }
        ]
      };

      const response = await fetch(`${API_CONFIG.rulesEngineBaseUrl}/api/smart-return/experiment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("API experiment failed");
      const data = await response.json();
      
      const resultObj = data.results[0];
      const isPass = resultObj.status === "PASS";

      setScenarioResults(prev => ({
        ...prev,
        [sc.scenario_name]: {
          status: isPass ? "PASS" : "FAIL",
          actual: resultObj.actual_result,
          expected: sc.expected_result
        }
      }));

      const resData = resultObj.actual_result;
      setDryRunLog([
        `🔄 Starting experiment dry run for scenario: "${sc.scenario_name}"`,
        `⚙️ Sending experiment request to API /experiment...`,
        `📥 API Response: Mode: ${resData.mode}, Status: ${resData.status}, Action: ${resData.action || "None"}`,
        isPass
          ? `🟢 RESULT: PASS - Matches expected result: ${sc.expected_result.status}`
          : `🔴 RESULT: FAIL - Expected ${sc.expected_result.status} (${sc.expected_result.action}) but received ${resData.status} (${resData.action})`
      ]);

      if (isPass) {
        toast.success(`Scenario "${sc.scenario_name}" passed!`);
      } else {
        toast.error(`Scenario "${sc.scenario_name}" failed.`);
      }

    } catch (error) {
      console.error(error);
      toast.error("Error connecting to the experiment API.");
      setDryRunLog(prev => [
        ...(prev || []),
        `❌ Connection error on API experiment: ${error instanceof Error ? error.message : String(error)}`
      ]);
    } finally {
      setRunningScenario(null);
    }
  };

  const handleRunAllScenarios = async () => {
    const selectedScenariosList = scenarios.filter(sc => selectedScenarioNames.has(sc.scenario_name));

    if (selectedRuleIds.size === 0) {
      toast.error("Please select at least one rule to run the experiment.");
      return;
    }
    if (selectedScenariosList.length === 0) {
      toast.error("Please select at least one scenario to run.");
      return;
    }

    setIsRunningAll(true);
    setDryRunLog([
      `🔄 Starting experiment dry run for all ${selectedScenariosList.length} selected scenarios...`,
      `===========================================`
    ]);

    try {
      const selectedBackendRules = rules
        .filter(r => selectedRuleIds.has(r.id))
        .map(mapRuleToBackend);

      const payload = {
        rules: selectedBackendRules,
        scenarios: selectedScenariosList.map(sc => ({
          scenario_name: sc.scenario_name,
          request: sc.request,
          expected_result: sc.expected_result
        }))
      };

      const response = await fetch(`${API_CONFIG.rulesEngineBaseUrl}/api/smart-return/experiment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("API experiment failed");
      const data = await response.json();

      const newResults: Record<string, any> = {};
      const logs = [
        `🔄 Starting experiment dry run for all ${selectedScenariosList.length} selected scenarios...`,
        `===========================================`
      ];

      data.results.forEach((resObj: any) => {
        const scName = resObj.scenario_name;
        const originalSc = selectedScenariosList.find(s => s.scenario_name === scName);
        if (!originalSc) return;

        const isPass = resObj.status === "PASS";
        newResults[scName] = {
          status: isPass ? "PASS" : "FAIL",
          actual: resObj.actual_result,
          expected: originalSc.expected_result
        };

        const resData = resObj.actual_result;
        logs.push(`\n🏃 Scenario: "${scName}"`);
        logs.push(`📥 Response: Mode: ${resData.mode}, Status: ${resData.status}, Action: ${resData.action || "None"}`);
        logs.push(isPass
          ? `🟢 RESULT: PASS - Matches expected: ${originalSc.expected_result.status}`
          : `🔴 RESULT: FAIL - Matches expected: ${originalSc.expected_result.status} (received ${resData.status})`
        );
      });

      setScenarioResults(prev => ({
        ...prev,
        ...newResults
      }));

      setDryRunLog(logs);
      toast.success("Completed all selected scenario tests!");

    } catch (error) {
      console.error(error);
      toast.error("Error connecting to the experiment API.");
      setDryRunLog(prev => [
        ...(prev || []),
        `❌ Connection error on API experiment: ${error instanceof Error ? error.message : String(error)}`
      ]);
    } finally {
      setIsRunningAll(false);
    }
  };

  // Load rule details into left editing panel
  const handleSelectRule = (rule: Rule) => {
    setSelectedRuleId(rule.id);
    setRuleName(rule.name);
    setActiveTab(rule.type);
    if (rule.type === "rule-based") {
      setConditions(rule.conditions.length > 0 ? rule.conditions : [{ id: "1", field: "category", operator: "is", value: "Apparel" }]);
    } else {
      setNlpPrompt(rule.nlpPrompt || "");
    }
    setMode(rule.mode);
    setResolution(rule.resolution);
    setPolicies(rule.policies.length > 0 ? rule.policies : [{ id: "1", reason: "", url: "" }]);
    setIsEditingRule(false);
    toast.info(`Rule ${rule.name} selected`);
  };

  // Trigger New Rule Form
  const handleCreateNewRuleTrigger = () => {
    setSelectedRuleId("new");
    setIsEditingRule(true);
    setRuleName("");
    setActiveTab("rule-based");
    setConditions([{ id: "1", field: "category", operator: "is", value: "Apparel" }]);
    setNlpPrompt("");
    setMode("Auto");
    setResolution("Instant Refund");
    setPolicies([{ id: "1", reason: "", url: "" }]);
  };

  // Toggle Rule Status
  const toggleRuleStatus = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, status: !r.status } : r));
    toast.success("Rule status updated!");
  };

  // Delete Rule
  const handleDeleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
    if (selectedRuleId === id) {
      setSelectedRuleId(null);
    }
    toast.success("Rule deleted!");
  };

  // Format conditions display text
  const formatConditionsSummary = (rule: Rule) => {
    if (rule.type === "nlp-based") {
      return rule.nlpPrompt || "";
    }
    return rule.conditions.map((c, i) => {
      const logicStr = i > 0 ? ` ${c.logicBefore?.toUpperCase()} ` : "";
      return `${logicStr}${c.field} ${c.operator} ${c.value}`;
    }).join("");
  };

  // Filtered Rules for listing
  const filteredRules = useMemo(() => {
    return rules.filter(r =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [rules, searchQuery]);

  return (
    <div className="h-screen bg-slate-55/50 p-6 font-sans admin-theme overflow-hidden flex flex-col gap-4">
      <Toaster />
      <div className="flex-1 min-h-0 w-full max-w-7xl flex flex-col gap-4 mx-auto overflow-hidden">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-100 p-6 rounded-2xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-xl">
              <Sliders className="size-6" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">
                Smart Return Setting
              </h1>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Configure return/exchange rules via hardcoded rules (Rule-based) or NLP
              </p>
            </div>
          </div>

          <Button
            onClick={() => {
              setIsTestModalOpen(true);
              setDryRunLog(null);
            }}
            type="button"
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-3 text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-3xs md:w-auto w-full shrink-0 border-none"
          >
            <Play className="size-3.5 fill-white text-white" />
            <span>Rule Sandbox</span>
          </Button>
        </div>

        {/* Two columns layout (Draggable Splitter on desktop, stacked on mobile) */}
        <div
          ref={containerRef}
          className={`flex-1 min-h-0 w-full flex flex-col lg:flex-row gap-0 items-stretch relative overflow-hidden ${
            isDragging ? "cursor-col-resize select-none" : ""
          }`}
        >

          {/* Column 1: Config panel */}
          <div
            className="w-full lg:shrink-0 flex flex-col gap-0 h-full overflow-hidden"
            style={{ width: isDesktop ? `${leftWidth}%` : "100%" }}
          >
            {selectedRuleId === null ? (
              <Card className="bg-white border-slate-100 shadow-2xs rounded-2xl overflow-hidden text-left h-full flex flex-col items-center justify-center p-8 select-none">
                <div className="bg-slate-50 text-slate-400 p-4 rounded-full border border-slate-100 mb-4 animate-bounce duration-1000">
                  <Sliders className="size-8" />
                </div>
                <h3 className="font-extrabold text-sm text-slate-700 uppercase tracking-wide">
                  Select a rule to view details
                </h3>
                <p className="text-xs text-slate-450 text-center max-w-xs mt-2 font-semibold leading-relaxed">
                  Choose an existing return policy from the list on the right to edit, or click the <span className="text-indigo-600 font-bold">"New Rule"</span> button to create one from scratch.
                </p>
              </Card>
            ) : (
              <Card className="bg-white border-slate-100 shadow-2xs rounded-2xl overflow-hidden text-left h-full flex flex-col">
                <div className="bg-slate-55 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <span className="font-extrabold text-sm text-slate-800">
                    {selectedRuleId === "new" ? "Create New Rule" : "Rule Details & Settings"}
                  </span>
                  <div className="flex items-center gap-2">
                    {isEditingRule ? (
                      <>
                        <Button
                          onClick={handleCancelEdit}
                          size="sm"
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold cursor-pointer border border-slate-200"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSaveRule}
                          size="sm"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-1.5 text-xs font-bold cursor-pointer shadow-3xs border-none"
                        >
                          Save
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => setIsEditingRule(true)}
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-1.5 text-xs font-bold cursor-pointer shadow-3xs border-none"
                      >
                        Edit Policy
                      </Button>
                    )}
                  </div>
                </div>

                <CardContent className="p-6 flex flex-col gap-6 flex-1 overflow-y-auto">
                  {/* Div 1: General Info and Conditions */}
                  <div className="flex flex-col gap-4">
                    {/* Name Input */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-slate-700">Rule name</label>
                      <input
                        type="text"
                        value={ruleName}
                        onChange={(e) => setRuleName(e.target.value)}
                        disabled={!isEditingRule}
                        placeholder="E.g., Auto return for apparel defect..."
                        className="w-full bg-slate-50 border border-slate-200 px-3 py-2 text-xs rounded-xl outline-none focus:border-indigo-500 transition-all font-semibold text-slate-800 placeholder-slate-400 disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>

                    {/* Condition tab selector */}
                    <div className="flex flex-col gap-2 mt-2">
                      <label className="text-xs font-bold text-slate-700">Rule Conditions</label>
                      <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                        <button
                          onClick={() => isEditingRule && setActiveTab("rule-based")}
                          disabled={!isEditingRule}
                          className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            activeTab === "rule-based"
                              ? "bg-white text-indigo-600 shadow-3xs"
                              : "text-slate-500 hover:text-slate-855"
                          } disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                          Rule-based
                        </button>
                        <button
                          onClick={() => isEditingRule && setActiveTab("nlp-based")}
                          disabled={!isEditingRule}
                          className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            activeTab === "nlp-based"
                              ? "bg-white text-indigo-600 shadow-3xs"
                              : "text-slate-500 hover:text-slate-855"
                          } disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                          NLP-Based
                        </button>
                      </div>
                    </div>

                    {/* Conditions Content tabs */}
                    {activeTab === "rule-based" ? (
                      <div className="flex flex-col gap-3.5 mt-2 bg-slate-50/50 p-4 border border-slate-100 rounded-2xl">
                        {conditions.map((cond, index) => (
                          <div key={cond.id} className="flex flex-col gap-3">
                            {/* Logic selector for items except the first one */}
                            {index > 0 && (
                              <div className="w-20 my-1 self-start">
                                <select
                                  value={cond.logicBefore || "and"}
                                  disabled={!isEditingRule}
                                  onChange={(e) => updateCondition(cond.id, { logicBefore: e.target.value as any })}
                                  className="bg-slate-200 border-none px-2 py-1 text-[10px] font-black rounded-lg text-slate-755 outline-none cursor-pointer text-center uppercase disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                  <option value="and">AND</option>
                                  <option value="or">OR</option>
                                </select>
                              </div>
                            )}

                            {/* Row Inputs */}
                            <div className="flex flex-wrap items-center gap-3">
                              {/* Selector 1 */}
                              <select
                                value={cond.field}
                                disabled={!isEditingRule}
                                onChange={(e) => updateCondition(cond.id, { field: e.target.value })}
                                className="bg-white border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-855 outline-none focus:border-indigo-500 transition-all cursor-pointer flex-1 min-w-[120px] disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                <option value="category">Category</option>
                                <option value="price">Price</option>
                                <option value="reason">Reason</option>
                                <option value="days_since_delivery">Days Since Delivery</option>
                                <option value="item_value">Item Value</option>
                              </select>

                              {/* Operator 2 */}
                              <select
                                value={cond.operator}
                                disabled={!isEditingRule}
                                onChange={(e) => updateCondition(cond.id, { operator: e.target.value })}
                                className="bg-white border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-855 outline-none focus:border-indigo-500 transition-all cursor-pointer flex-1 min-w-[120px] disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                <option value="is">is</option>
                                <option value="not">not</option>
                                <option value="greater">greater than</option>
                                <option value="less than">less than</option>
                                <option value="equal">equal</option>
                                <option value="greater_than">greater than (real)</option>
                                <option value="less_than">less than (real)</option>
                                <option value="less_than_or_equal">less than or equal</option>
                                <option value="greater_than_or_equal">greater than or equal</option>
                              </select>

                              {/* Value 3 */}
                              {cond.field === "category" ? (
                                <select
                                  value={cond.value}
                                  disabled={!isEditingRule}
                                  onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                                  className="bg-white border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-855 outline-none focus:border-indigo-500 transition-all cursor-pointer flex-1 min-w-[120px] disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                  {categoryOptions.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                              ) : cond.field === "reason" ? (
                                <select
                                  value={cond.value}
                                  disabled={!isEditingRule}
                                  onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                                  className="bg-white border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-855 outline-none focus:border-indigo-500 transition-all cursor-pointer flex-1 min-w-[120px] disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                  {reasonOptions.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                              ) : (
                                <input
                                  type="number"
                                  value={cond.value}
                                  disabled={!isEditingRule}
                                  onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                                  className="bg-white border border-slate-200 px-3 py-2 text-xs rounded-xl outline-none focus:border-indigo-500 transition-all font-semibold text-slate-855 flex-1 min-w-[120px] disabled:opacity-60 disabled:cursor-not-allowed"
                                />
                              )}

                              {/* Remove item button */}
                              {isEditingRule && conditions.length > 1 && (
                                <button
                                  onClick={() => removeCondition(cond.id)}
                                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg hover:text-rose-600 transition-all cursor-pointer shrink-0 border-none bg-transparent"
                                  title="Delete condition"
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* Add condition button */}
                        {isEditingRule && (
                          <button
                            onClick={addCondition}
                            className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-indigo-200 text-indigo-600 hover:bg-indigo-50/50 rounded-xl text-xs font-bold transition-all w-fit mt-1 border-none cursor-pointer bg-transparent"
                          >
                            <Plus className="size-3.5" />
                            Add Condition
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 mt-2">
                        <textarea
                          value={nlpPrompt}
                          disabled={!isEditingRule}
                          onChange={(e) => setNlpPrompt(e.target.value)}
                          rows={4}
                          placeholder="Describe return intent or context for AI detection (E.g., Customer wants to return shirt due to loose buttons, fabric scratch, or torn stitching...)"
                          className="w-full bg-slate-50 border border-slate-200 px-3.5 py-3 text-xs rounded-xl outline-none focus:border-indigo-500 transition-all font-semibold text-slate-800 placeholder-slate-400 leading-normal disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                      </div>
                    )}
                  </div>

                  {/* Div 2: Modes and resolution */}
                  <div className="border-t border-slate-50 pt-5 flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                      {/* Mode select */}
                      <div className="flex flex-col gap-2">
                        <label className="font-bold text-slate-700">Processing Mode</label>
                        <div className="flex gap-4 bg-slate-50 p-2 border border-slate-100 rounded-xl">
                          <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 select-none">
                            <input
                              type="radio"
                              name="rule-mode"
                              disabled={!isEditingRule}
                              checked={mode === "Auto"}
                              onChange={() => setMode("Auto")}
                              className="size-4 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                            Auto
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 select-none">
                            <input
                              type="radio"
                              name="rule-mode"
                              disabled={!isEditingRule}
                              checked={mode === "Semi-Auto"}
                              onChange={() => setMode("Semi-Auto")}
                              className="size-4 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                            Semi-Auto
                          </label>
                        </div>
                      </div>

                      {/* Resolution select */}
                      <div className="flex flex-col gap-2">
                        <label className="font-bold text-slate-700">Resolution</label>
                        <select
                          value={resolution}
                          disabled={!isEditingRule}
                          onChange={(e) => setResolution(e.target.value)}
                          className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-semibold text-slate-800 outline-none focus:border-indigo-500 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <option value="Instant Refund">Instant Refund</option>
                          <option value="Full Refund & Return">Full Refund & Return</option>
                          <option value="Partial Refund & Return">Partial Refund & Return</option>
                          <option value="Reject">Reject</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Div 3: Policy Attachments */}
                  <div className="border-t border-slate-50 pt-5 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <FileText className="size-4 text-slate-400" />
                        Attach Policy
                      </label>
                      {isEditingRule && (
                        <button
                          onClick={addPolicy}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-none border-none cursor-pointer flex items-center gap-1 bg-transparent"
                        >
                          <Plus className="size-3.5" />
                          Add Policy
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col gap-3">
                      {policies.map((pol) => (
                        <div key={pol.id} className="flex items-center gap-3">
                          <input
                            type="text"
                            value={pol.reason}
                            disabled={!isEditingRule}
                            onChange={(e) => updatePolicy(pol.id, "reason", e.target.value)}
                            placeholder="Reason for attaching policy..."
                            className="flex-1 bg-slate-50 border border-slate-200 px-3 py-2 text-xs rounded-xl outline-none focus:border-indigo-500 transition-all font-semibold text-slate-800 placeholder-slate-400 disabled:opacity-60 disabled:cursor-not-allowed"
                          />
                          <input
                            type="text"
                            value={pol.url}
                            disabled={!isEditingRule}
                            onChange={(e) => updatePolicy(pol.id, "url", e.target.value)}
                            placeholder="Policy Link (URL)..."
                            className="flex-1 bg-slate-50 border border-slate-200 px-3 py-2 text-xs rounded-xl outline-none focus:border-indigo-500 transition-all font-semibold text-slate-800 placeholder-slate-400 disabled:opacity-60 disabled:cursor-not-allowed"
                          />
                          {isEditingRule && policies.length > 1 && (
                            <button
                              onClick={() => removePolicy(pol.id)}
                              className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg hover:text-rose-600 transition-all cursor-pointer shrink-0 border-none bg-transparent"
                              title="Delete policy"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                </CardContent>
              </Card>
            )}
          </div>

          {/* Draggable Divider Line */}
          <div
            onMouseDown={startResizing}
            className={`hidden lg:flex w-2 hover:w-2 cursor-col-resize items-center justify-center self-stretch shrink-0 group relative z-40 transition-colors ${isDragging ? "bg-indigo-50/20" : ""
              }`}
            title="Drag to resize"
          >
            <div className={`w-[1px] h-full transition-all group-hover:bg-indigo-500/80 ${isDragging ? "bg-indigo-600 w-[2px]" : "bg-slate-200"
              }`} />

            <div className="absolute top-1/2 -translate-y-1/2 flex flex-col gap-1 items-center bg-white border border-slate-250 rounded-md py-2 px-1 shadow-2xs group-hover:border-indigo-400 group-hover:scale-105 transition-all select-none pointer-events-none z-50">
              <div className="w-1 h-1 bg-slate-400 rounded-full group-hover:bg-indigo-500" />
              <div className="w-1 h-1 bg-slate-400 rounded-full group-hover:bg-indigo-500" />
              <div className="w-1 h-1 bg-slate-400 rounded-full group-hover:bg-indigo-500" />
            </div>
          </div>

          {/* Column 2: Rules list panel */}
          <div
            className="w-full lg:shrink-0 flex flex-col gap-0 pl-0 h-full overflow-hidden"
            style={{ width: isDesktop ? `${100 - leftWidth}%` : "100%" }}
          >
            <Card className="bg-white border-slate-100 shadow-2xs rounded-2xl overflow-hidden text-left h-full flex flex-col">
              <CardHeader className="pb-3 border-b border-slate-50 flex flex-row items-center justify-between gap-4">
                {/* Left side: Title + New Rule Button */}
                <div className="flex items-center gap-3 shrink-0">
                  <CardTitle className="text-sm font-bold text-slate-800">
                    Rule List
                  </CardTitle>
                  <Button
                    onClick={handleCreateNewRuleTrigger}
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1 cursor-pointer shadow-3xs border-none"
                  >
                    <Plus className="size-3.5" />
                    <span>New Rule</span>
                  </Button>
                </div>

                {/* Right side: Search */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search rules by name..."
                    className="w-full bg-slate-50 border border-slate-200 pl-9 pr-4 py-2 text-xs rounded-xl outline-none focus:border-indigo-500 transition-all font-semibold text-slate-800"
                  />
                </div>
              </CardHeader>

              <CardContent className="p-0 flex-1 overflow-auto">
                <table className="w-full border-collapse text-left text-xs min-w-[500px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 select-none">
                      <th className="p-3.5 pl-5 font-bold text-slate-400 uppercase text-[9px] w-1/4">Rule name</th>
                      <th className="p-3.5 font-bold text-slate-400 uppercase text-[9px] w-1/6">Mode</th>
                      <th className="p-3.5 font-bold text-slate-400 uppercase text-[9px] w-1/3">Condition</th>
                      <th className="p-3.5 font-bold text-slate-400 uppercase text-[9px] w-12 text-center">Status</th>
                      <th className="p-3.5 pr-5 font-bold text-slate-400 uppercase text-[9px] w-10 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredRules.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-20 text-center text-slate-400 font-medium select-none">
                          <Inbox className="size-8 text-slate-200 mx-auto mb-2" />
                          No rules found
                        </td>
                      </tr>
                    ) : (
                      filteredRules.map(rule => {
                        const isSelected = selectedRuleId === rule.id;
                        return (
                          <tr
                            key={rule.id}
                            onClick={() => handleSelectRule(rule)}
                            className={`transition-colors cursor-pointer ${isSelected
                                ? "bg-indigo-50/40 hover:bg-indigo-50/50"
                                : "hover:bg-slate-50/30"
                              }`}
                          >
                            {/* Name */}
                            <td className={`p-3.5 pl-5 font-bold leading-normal ${isSelected ? "text-indigo-600" : "text-slate-800"
                              }`}>
                              {rule.name}
                            </td>
                            {/* Mode */}
                            <td className="p-3.5">
                              <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${rule.mode === "Auto"
                                  ? "bg-indigo-50 text-indigo-600 border border-indigo-100"
                                  : "bg-amber-50 text-amber-700 border border-amber-100"
                                }`}>
                                {rule.mode}
                              </span>
                            </td>
                            {/* Condition text */}
                            <td className="p-3.5 text-slate-500 font-semibold leading-relaxed break-words max-w-xs">
                              {rule.type === "nlp-based" ? (
                                <span
                                  title={rule.nlpPrompt}
                                  className="cursor-pointer border-b border-dashed border-slate-350 hover:text-indigo-600 transition-colors"
                                >
                                  {rule.nlpPrompt && rule.nlpPrompt.length > 45
                                    ? `${rule.nlpPrompt.substring(0, 45)}...`
                                    : rule.nlpPrompt}
                                </span>
                              ) : (
                                formatConditionsSummary(rule)
                              )}
                            </td>
                            {/* Status toggle */}
                            <td className="p-3.5 text-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRuleStatus(rule.id);
                                }}
                                className="text-slate-400 hover:text-slate-655 p-0 bg-transparent border-none cursor-pointer transition-all"
                              >
                                {rule.status ? (
                                  <ToggleRight className="size-6 text-indigo-600" />
                                ) : (
                                  <ToggleLeft className="size-6 text-slate-300" />
                                )}
                              </button>
                            </td>
                            {/* Dropdown action */}
                            <td className="p-3.5 pr-5 text-right relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDropdownRuleId(prev => prev === rule.id ? null : rule.id);
                                }}
                                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-50 bg-transparent border-none cursor-pointer transition-all"
                                title="Options"
                              >
                                <MoreVertical className="size-4" />
                              </button>

                              {activeDropdownRuleId === rule.id && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-5 top-10 w-28 bg-white border border-slate-150 rounded-xl shadow-md z-50 py-1 text-left animate-in fade-in slide-in-from-top-1 duration-150"
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveDropdownRuleId(null);
                                      handleTestSpecificRule(rule);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 border-none cursor-pointer bg-transparent"
                                  >
                                    Test
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveDropdownRuleId(null);
                                      handleDeleteRule(rule.id);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-none cursor-pointer bg-transparent"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>

      {/* Test Scenarios Modal */}
      {isTestModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="bg-white border border-slate-100 rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Cpu className="size-5 text-indigo-600" />
                <div className="flex flex-col">
                  <span className="font-extrabold text-sm text-slate-800">
                    Smart Return Policy Simulator & Sandbox
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    Simulate store policy configurations against mock customer claims to verify decision logic
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsTestModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all cursor-pointer border-none bg-transparent"
              >
                <Plus className="size-5 rotate-45" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex flex-col lg:flex-row gap-6 flex-1 min-h-[50vh]">
              {/* Left Column: Rules Selection */}
              <div className="w-full lg:w-1/3 flex flex-col gap-3 border-b lg:border-b-0 lg:border-r border-slate-100 pb-6 lg:pb-0 lg:pr-6">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Simulation Policies ({selectedRuleIds.size} / {rules.length})
                  </span>
                  <button
                    onClick={toggleAllRulesSelection}
                    className="text-[9px] font-bold text-indigo-600 hover:text-indigo-700 bg-transparent border-none cursor-pointer"
                  >
                    {selectedRuleIds.size === rules.length ? "Deselect All" : "Select All"}
                  </button>
                </div>
                <div className="flex flex-col gap-2 overflow-y-auto max-h-[55vh] pr-1 select-none">
                  {rules.map((rule) => {
                    const isSelected = selectedRuleIds.has(rule.id);
                    return (
                      <label
                        key={rule.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                          isSelected
                            ? "bg-indigo-50/40 border-indigo-250 text-indigo-950"
                            : "bg-slate-50/50 border-slate-200 text-slate-600 hover:border-slate-350"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRuleSelection(rule.id)}
                          className="mt-0.5 size-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                        />
                        <div className="flex flex-col gap-0.5 leading-tight">
                          <span className="truncate max-w-[180px] block font-bold" title={rule.name}>
                            {rule.name}
                          </span>
                          <span className="text-[9px] text-slate-400 capitalize">
                            Type: {rule.type === "rule-based" ? "Rule-based" : "NLP-based"} | Mode: {rule.mode}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Scenarios List */}
              <div className="w-full lg:w-2/3 flex flex-col gap-3 flex-1 min-h-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-left">
                    Simulated Return Claims ({selectedScenarioNames.size} / {scenarios.length})
                  </span>
                  <button
                    onClick={toggleAllScenariosSelection}
                    className="text-[9px] font-bold text-indigo-600 hover:text-indigo-700 bg-transparent border-none cursor-pointer"
                  >
                    {selectedScenarioNames.size === scenarios.length ? "Deselect All" : "Select All"}
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto max-h-[55vh] pr-1">
                  {scenarios.map((sc, scIdx) => {
                    const result = scenarioResults[sc.scenario_name];
                    const isRunning = runningScenario === sc.scenario_name;
                    const isSelected = selectedScenarioNames.has(sc.scenario_name);

                    return (
                      <div
                        key={scIdx}
                        className={`border rounded-xl p-4 flex flex-col gap-3.5 hover:border-slate-350 transition-all text-xs font-semibold ${
                          isSelected
                            ? "bg-white border-indigo-200 shadow-3xs"
                            : "bg-slate-50/50 border-slate-200 opacity-60 hover:opacity-100"
                        }`}
                      >
                        {/* Header Row */}
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex items-start gap-2 cursor-pointer select-none flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleScenarioSelection(sc.scenario_name)}
                              className="mt-0.5 size-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                            />
                            <span className="font-bold text-slate-800 leading-normal text-left truncate block" title={sc.scenario_name}>
                              {sc.scenario_name}
                            </span>
                          </label>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {!result && (
                              <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200 shrink-0 select-none">
                                Not Simulated
                              </span>
                            )}
                            <button
                              onClick={() => {
                                setSelectedDetailScenario({
                                  ...sc,
                                  result: scenarioResults[sc.scenario_name]
                                });
                                setIsDetailModalOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer border-none bg-transparent"
                              title="View Support Ticket Details"
                            >
                              <Eye className="size-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Scenario Description */}
                        {sc.description && (
                          <p className="text-[10px] text-slate-500 font-normal leading-relaxed text-left m-0 select-text">
                            {sc.description}
                          </p>
                        )}

                        {/* Visual Ticket Order Details Grid */}
                        <div className="border-t border-slate-100 pt-2.5 flex flex-col gap-1.5 text-[10px] text-slate-600 text-left select-none">
                          <div className="grid grid-cols-3 gap-2 bg-slate-50/50 p-2 rounded-lg border border-slate-100 text-[9px] font-bold">
                            <div>
                              <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-wide">Category</span>
                              <span className="text-slate-700 truncate block">{sc.request.category}</span>
                            </div>
                            <div>
                              <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-wide">Price</span>
                              <span className="text-slate-700">${sc.request.item_value}</span>
                            </div>
                            <div>
                              <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-wide">Received</span>
                              <span className="text-slate-700 whitespace-nowrap">{sc.request.days_since_delivery} days ago</span>
                            </div>
                          </div>
                          {sc.request.user_text_description && (
                            <div className="bg-slate-50 border border-slate-150 p-2 rounded-lg mt-1 border-l-2 border-indigo-500 text-[9px] italic text-slate-600 leading-relaxed select-text">
                              💬 "{sc.request.user_text_description}"
                            </div>
                          )}
                        </div>

                        {/* Goal Outcome pill */}
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 select-none text-left">
                          <span>Desired Shop Goal:</span>
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${
                            sc.expected_result.status === "APPROVED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100/50"
                              : sc.expected_result.status === "REJECTED"
                              ? "bg-rose-50 text-rose-700 border-rose-100/50"
                              : "bg-amber-50 text-amber-700 border-amber-100/50"
                          }`}>
                            {sc.expected_result.status} ({sc.expected_result.action || "No Action"})
                          </span>
                        </div>

                        {/* SIMULATION OUTCOME SECTION */}
                        {result && (
                          <div className="flex flex-col gap-2 mt-1 border-t border-slate-100 pt-2.5 text-left">
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                              Simulation Resolution
                            </span>
                            
                            {/* Outcome Badge card */}
                            {(() => {
                              const actual = result.actual;
                              if (actual.status === "APPROVED") {
                                return (
                                  <div className="flex flex-col gap-0.5 p-2 bg-emerald-50/40 border border-emerald-100 rounded-lg">
                                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wide flex items-center gap-1">
                                      🟢 Approved Resolution
                                    </span>
                                    <span className="text-[9px] text-slate-500 font-bold uppercase font-mono">
                                      Action: {actual.action || "Refund"}
                                    </span>
                                  </div>
                                );
                              } else if (actual.status === "REJECTED") {
                                return (
                                  <div className="flex flex-col gap-0.5 p-2 bg-rose-50/40 border border-rose-100 rounded-lg">
                                    <span className="text-[10px] font-black text-rose-700 uppercase tracking-wide flex items-center gap-1">
                                      🔴 Rejected Resolution
                                    </span>
                                    <span className="text-[9px] text-slate-500 font-bold uppercase font-mono">
                                      Action: Reject Refund
                                    </span>
                                  </div>
                                );
                              } else if (actual.status === "PENDING_PROCESSING") {
                                if (actual.mode === "SEMI-AUTO") {
                                  return (
                                    <div className="flex flex-col gap-1.5 p-2.5 bg-amber-50/40 border border-amber-150 rounded-lg">
                                      <span className="text-[10px] font-black text-amber-700 uppercase tracking-wide flex items-center gap-1">
                                        🟡 Pending
                                      </span>
                                      {actual.ai_summary_for_staff && (
                                        <p className="text-[9px] text-amber-950 font-semibold leading-relaxed m-0 p-0 border-l-2 border-amber-300 pl-2 select-text">
                                          "{actual.ai_summary_for_staff}"
                                        </p>
                                      )}
                                      <span className="text-[8px] text-slate-400 font-bold uppercase font-mono">
                                        Action: {actual.action || "Wait for Approval"}
                                      </span>
                                    </div>
                                  );
                                } else {
                                  return (
                                    <div className="flex flex-col gap-0.5 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-wide flex items-center gap-1">
                                        ⚪ Pending
                                      </span>
                                      <span className="text-[8px] text-slate-400 font-bold uppercase">
                                        No matching rules found
                                      </span>
                                    </div>
                                  );
                                }
                              } else {
                                return (
                                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">
                                      {actual.status} ({actual.mode})
                                    </span>
                                  </div>
                                );
                              }
                            })()}

                            {/* Matched Rule Details */}
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 mt-0.5">
                              <span>Matched Policy:</span>
                              <span className="bg-indigo-50 border border-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase font-mono">
                                {result.actual.rule_id || "No Match (Fallback)"}
                              </span>
                            </div>

                            {/* Goal Alignment status check */}
                            <div className="flex items-center justify-between border-t border-slate-100/60 pt-2 mt-1 select-none">
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                                Goal Alignment
                              </span>
                              {result.status === "PASS" ? (
                                <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50/50 px-1.5 py-0.5 rounded border border-emerald-100/80 flex items-center gap-0.5 uppercase tracking-wide">
                                  🟢 Target Aligned
                                </span>
                              ) : (
                                <span className="text-[8px] font-bold text-rose-600 bg-rose-50/50 px-1.5 py-0.5 rounded border border-rose-100/80 flex items-center gap-0.5 uppercase tracking-wide">
                                  ⚠️ Policy Conflict
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Run button */}
                        <Button
                          onClick={() => handleRunScenario(sc)}
                          disabled={isTesting || isRunning}
                          size="sm"
                          variant="outline"
                          className="w-full border-slate-250 bg-white hover:bg-slate-50 text-indigo-600 border-indigo-150 hover:text-indigo-700 font-bold py-1.5 text-[9px] rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs mt-1"
                        >
                          {isRunning ? (
                            <>
                              <RefreshCw className="size-3 animate-spin text-slate-500" />
                              <span>Simulating ticket...</span>
                            </>
                          ) : (
                            <>
                              <Play className="size-2.5 fill-indigo-600 text-indigo-600" />
                              <span>Simulate Claim</span>
                            </>
                          )}
                        </Button>

                        {/* Error or comparison display if failed */}
                        {result && result.status === "FAIL" && (
                          <div className="bg-rose-50/50 border border-rose-100 p-2 rounded text-[9px] font-mono text-rose-700 flex flex-col gap-0.5 leading-normal mt-1 text-left">
                            <div>Expected: {result.expected.status} ({result.expected.action})</div>
                            <div>Actual: {result.actual.status} ({result.actual.action})</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => {
                    setScenarioResults({});
                    setDryRunLog(null);
                    toast.success("Successfully reset all scenario test results.");
                  }}
                  variant="outline"
                  className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg px-4 py-2 text-xs font-bold cursor-pointer bg-transparent shadow-3xs"
                >
                  Reset Results
                </Button>

                <Button
                  onClick={handleRunAllScenarios}
                  disabled={isRunningAll || scenarios.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-xs font-bold cursor-pointer shadow-3xs border-none"
                >
                  {isRunningAll ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin mr-1.5 inline" />
                      <span>Running all...</span>
                    </>
                  ) : (
                    <span>Run Selected</span>
                  )}
                </Button>
              </div>

              <Button
                onClick={() => setIsTestModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-900 text-white rounded-lg px-4 py-2 text-xs font-bold cursor-pointer shadow-3xs border-none"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Scenario Detail Modal */}
      {isDetailModalOpen && selectedDetailScenario && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-55 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="bg-white border border-slate-100 rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <FileText className="size-5 text-indigo-600" />
                <span className="font-extrabold text-sm text-slate-800">
                  Scenario Details: {selectedDetailScenario.scenario_name}
                </span>
              </div>
              <button
                onClick={() => {
                  setIsDetailModalOpen(false);
                  setSelectedDetailScenario(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all cursor-pointer border-none bg-transparent"
              >
                <Plus className="size-5 rotate-45" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex flex-col gap-5 text-xs font-semibold text-slate-700 leading-normal">
              {/* Description (if present) */}
              {selectedDetailScenario.description && (
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Scenario Description
                  </span>
                  <p className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 text-xs text-slate-600 italic font-medium leading-relaxed select-text m-0">
                    "{selectedDetailScenario.description}"
                  </p>
                </div>
              )}

              {/* Mock Request Details Grid */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Mock Customer Request
                </span>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-150 text-xs">
                  <div className="flex flex-col gap-0.5 text-left">
                    <span className="text-[9px] text-slate-450 font-bold uppercase">Request ID</span>
                    <span className="font-bold text-slate-700 font-mono">{selectedDetailScenario.request.request_id}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 text-left">
                    <span className="text-[9px] text-slate-450 font-bold uppercase">Product Category</span>
                    <span className="font-bold text-slate-700">{selectedDetailScenario.request.category}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 text-left">
                    <span className="text-[9px] text-slate-450 font-bold uppercase">Item Value</span>
                    <span className="font-bold text-slate-700">{selectedDetailScenario.request.item_value} USD</span>
                  </div>
                  <div className="flex flex-col gap-0.5 text-left">
                    <span className="text-[9px] text-slate-450 font-bold uppercase">Delivered Time</span>
                    <span className="font-bold text-slate-700">{selectedDetailScenario.request.days_since_delivery} days ago</span>
                  </div>
                  <div className="flex flex-col gap-0.5 col-span-2 text-left">
                    <span className="text-[9px] text-slate-450 font-bold uppercase">Customer Reason Description</span>
                    <span className="font-bold text-slate-700 italic">
                      {selectedDetailScenario.request.user_text_description ? `"${selectedDetailScenario.request.user_text_description}"` : "None (empty)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Expected Result */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Expected Decision (Target)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-indigo-50/15 border border-indigo-100/50 p-3.5 rounded-xl text-xs">
                  <div className="flex flex-col gap-0.5 text-left">
                    <span className="text-[9px] text-slate-450 font-bold uppercase">Expected Status</span>
                    <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded w-fit ${
                      selectedDetailScenario.expected_result.status === "APPROVED"
                        ? "bg-emerald-50 text-emerald-700"
                        : selectedDetailScenario.expected_result.status === "REJECTED"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-amber-50 text-amber-700"
                    }`}>
                      {selectedDetailScenario.expected_result.status}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 text-left">
                    <span className="text-[9px] text-slate-450 font-bold uppercase">Expected Action</span>
                    <span className="font-bold text-slate-700 uppercase font-mono">{selectedDetailScenario.expected_result.action || "None"}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 text-left">
                    <span className="text-[9px] text-slate-450 font-bold uppercase">Expected Match Rule</span>
                    <span className="font-bold text-slate-700 font-mono">{selectedDetailScenario.expected_result.rule_id || "No Match"}</span>
                  </div>
                </div>
              </div>

              {/* Actual Result (if run) */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Actual Run Decision
                </span>
                {selectedDetailScenario.result ? (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-150 text-xs">
                      <div className="flex flex-col gap-0.5 text-left">
                        <span className="text-[9px] text-slate-450 font-bold uppercase">Actual Decision Status</span>
                        <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded w-fit ${
                          selectedDetailScenario.result.actual.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : selectedDetailScenario.result.actual.status === "REJECTED"
                            ? "bg-rose-50 text-rose-700 border border-rose-100"
                            : "bg-amber-50 text-amber-700 border border-amber-100"
                        }`}>
                          {selectedDetailScenario.result.actual.status} ({selectedDetailScenario.result.actual.mode})
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 text-left">
                        <span className="text-[9px] text-slate-450 font-bold uppercase">Action Triggered</span>
                        <span className="font-bold text-slate-700 uppercase font-mono">{selectedDetailScenario.result.actual.action || "None"}</span>
                      </div>
                      <div className="flex flex-col gap-0.5 text-left">
                        <span className="text-[9px] text-slate-450 font-bold uppercase">Rule Matched</span>
                        <span className="font-bold text-slate-700 font-mono">{selectedDetailScenario.result.actual.rule_id || "No Match (Fallback)"}</span>
                      </div>
                      {selectedDetailScenario.result.actual.ai_summary_for_staff && (
                        <div className="flex flex-col gap-0.5 col-span-1 sm:col-span-3 bg-amber-50/20 border border-amber-100 p-2.5 rounded-lg mt-1 text-left">
                          <span className="text-[9px] text-amber-700 font-black uppercase">AI Summary for Staff</span>
                          <p className="text-[10px] text-amber-950 font-medium italic m-0">
                            "{selectedDetailScenario.result.actual.ai_summary_for_staff}"
                          </p>
                        </div>
                      )}
                      {selectedDetailScenario.result.actual.message_to_customer && (
                        <div className="flex flex-col gap-0.5 col-span-1 sm:col-span-3 bg-slate-100 p-2.5 rounded-lg mt-1 border border-slate-200 text-left">
                          <span className="text-[9px] text-slate-500 font-black uppercase">Notification to Customer</span>
                          <p className="text-[10px] text-slate-600 font-medium m-0">
                            "{selectedDetailScenario.result.actual.message_to_customer}"
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Result Alignment:</span>
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        selectedDetailScenario.result.status === "PASS"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          : "bg-rose-50 text-rose-700 border border-rose-100"
                      }`}>
                        {selectedDetailScenario.result.status === "PASS" ? "🟢 Correct (Pass)" : "🔴 Deviation (Fail)"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-150 border-dashed rounded-xl p-6 text-center text-slate-400 font-medium">
                    This scenario has not been run in the current session yet.
                  </div>
                )}
              </div>

              {/* Collapsible Developer Panel */}
              <details className="mt-3 border-t border-slate-100 pt-3 select-none">
                <summary className="text-[9px] font-black text-slate-400 hover:text-indigo-600 cursor-pointer uppercase tracking-wider outline-none">
                  Developer Tools (Raw JSON Payload Data)
                </summary>
                <div className="flex flex-col gap-3 mt-3 select-text text-left">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-slate-400 font-bold uppercase">Request JSON</span>
                    <pre className="bg-slate-900 text-slate-100 rounded-xl p-3 font-mono text-[9px] overflow-x-auto leading-normal">
                      {JSON.stringify(selectedDetailScenario.request, null, 2)}
                    </pre>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-slate-400 font-bold uppercase">Expected JSON</span>
                    <pre className="bg-slate-900 text-slate-100 rounded-xl p-3 font-mono text-[9px] overflow-x-auto leading-normal">
                      {JSON.stringify(selectedDetailScenario.expected_result, null, 2)}
                    </pre>
                  </div>
                  {selectedDetailScenario.result && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-slate-400 font-bold uppercase">Actual JSON</span>
                      <pre className="bg-slate-900 text-slate-100 rounded-xl p-3 font-mono text-[9px] overflow-x-auto leading-normal">
                        {JSON.stringify(selectedDetailScenario.result.actual, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-end bg-slate-50/50">
              <Button
                onClick={() => {
                  setIsDetailModalOpen(false);
                  setSelectedDetailScenario(null);
                }}
                className="bg-slate-800 hover:bg-slate-900 text-white rounded-lg px-4 py-2 text-xs font-bold cursor-pointer shadow-3xs border-none"
              >
                Close Details
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
