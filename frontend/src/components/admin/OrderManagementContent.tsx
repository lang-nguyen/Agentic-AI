"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Search, 
  Inbox, 
  User, 
  MapPin, 
  CreditCard, 
  RotateCcw, 
  CheckCircle2, 
  Package, 
  RefreshCw, 
  Check, 
  AlertCircle,
  Truck,
  TrendingUp,
  XCircle,
  Clock,
  Sparkles,
  ShoppingBag
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/common/ui/card";
import { Button } from "@/components/common/ui/button";
import { toast } from "sonner";
import { Toaster } from "@/components/common/ui/sonner";
import { translations, Locale } from "@/locales/translations";
import { API_CONFIG } from "@/config/api";

// TypeScript model definitions independent of mock data
export interface OrderItem {
  item_id: string;
  product_id: string;
  name: string;
  price: number;
  options: Record<string, string>;
  imageUrl?: string;
  quantity: number;
}

export interface Order {
  order_id: string;
  user_id?: string;
  address: {
    address1: string;
    city: string;
    state: string;
  };
  items: OrderItem[];
  status: string; 
  date: string;
  total: number;
}

export function OrderManagementContent({ 
  initialFilter = "all" 
}: { 
  initialFilter?: "all" | "delivered" | "return requested" | "exchange requested" | "returned" 
}) {
  const [orders, setOrders] = useState<Record<string, Order>>({});
  const [users, setUsers] = useState<Record<string, any>>({});
  const [returnRequests, setReturnRequests] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter);
  const [locale, setLocale] = useState<Locale>("en"); // Force default language to English

  // Form states for return processing
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [returnReason, setReturnReason] = useState("wrong_size");
  const [returnToInventory, setReturnToInventory] = useState(true);
  const [refundMethod, setRefundMethod] = useState("original");
  
  // Show/hide POS return panel
  const [showReturnPanel, setShowReturnPanel] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch all orders, users and return requests from MongoDB API
  const fetchOrdersAndUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("store:token");
      
      // 1. Fetch Users
      const usersRes = await fetch(`${API_CONFIG.webBackendBaseUrl}/api/admin/users`, {
        headers: {
          "Authorization": token ? `Bearer ${token}` : "",
        }
      });
      let usersMap: Record<string, any> = {};
      if (usersRes.ok) {
        const usersList = await usersRes.json();
        usersList.forEach((u: any) => {
          usersMap[u.id] = {
            id: u.id,
            first_name: u.name ? (u.name.first_name || u.name.firstName) : "",
            last_name: u.name ? (u.name.last_name || u.name.lastName) : "",
            email: u.email || ""
          };
        });
        setUsers(usersMap);
      }

      // 2. Fetch Orders
      const ordersRes = await fetch(`${API_CONFIG.webBackendBaseUrl}/api/admin/orders`, {
        headers: {
          "Authorization": token ? `Bearer ${token}` : "",
        }
      });
      if (!ordersRes.ok) {
        if (ordersRes.status === 401) {
          throw new Error("Unauthorized. Please log in as an Admin.");
        }
        throw new Error("Unable to load orders from database");
      }
      const ordersList = await ordersRes.json();
      const ordersMap: Record<string, Order> = {};
      ordersList.forEach((o: any) => {
        ordersMap[o.orderId] = {
          order_id: o.orderId,
          user_id: o.userId,
          address: o.address || { address1: "", city: "", state: "" },
          items: o.items ? o.items.map((it: any) => ({
            item_id: it.itemId || Math.random().toString(),
            product_id: it.productId,
            name: it.name,
            price: it.price,
            options: it.options || {},
            imageUrl: it.imageUrl || "",
            quantity: it.quantity || 1
          })) : [],
          status: (o.status || "pending").replace("_", " "),
          date: o.createdAt ? new Date(o.createdAt).toLocaleString("en-US") : "N/A",
          total: o.items ? o.items.reduce((sum: number, it: any) => sum + (it.price * (it.quantity || 1)), 0) : 0
        };
      });
      setOrders(ordersMap);

      // 3. Fetch Return Requests
      const returnRes = await fetch(`${API_CONFIG.webBackendBaseUrl}/api/admin/return-requests`, {
        headers: {
          "Authorization": token ? `Bearer ${token}` : "",
        }
      });
      let returnMap: Record<string, any> = {};
      if (returnRes.ok) {
        const returnList = await returnRes.json();
        returnList.forEach((r: any) => {
          if (!returnMap[r.orderId] || r.status === "PENDING_PROCESSING") {
            returnMap[r.orderId] = r;
          }
        });
        setReturnRequests(returnMap);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load order dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrdersAndUsers();
  }, []);

  useEffect(() => {
    if (Object.keys(orders).length > 0) {
      if (initialFilter === "return requested") {
        setStatusFilter("return requested");
        const orderList = Object.values(orders);
        const firstReturnOrder = orderList.find(o => o.status === "return requested" || o.status === "exchange requested");
        if (firstReturnOrder) {
          setSelectedOrderId(firstReturnOrder.order_id);
        }
      } else {
        setStatusFilter(initialFilter);
      }
    }
  }, [orders, initialFilter]);

  const activeOrder = selectedOrderId ? orders[selectedOrderId] : null;

  // Retrieve customer profile for active order
  const activeUser = useMemo(() => {
    if (!activeOrder || !activeOrder.user_id) return null;
    return users[activeOrder.user_id] || null;
  }, [activeOrder, users]);

  // Retrieve the corresponding active Return Request for the active order
  const activeReturnRequest = useMemo(() => {
    if (!activeOrder) return null;
    return returnRequests[activeOrder.order_id] || null;
  }, [activeOrder, returnRequests]);

  // Helper method to highlight items selected for return in online request
  const isItemReturned = useCallback((itemId: string) => {
    if (!activeReturnRequest) return false;
    return activeReturnRequest.items?.some((i: any) => i.itemId === itemId || i.item_id === itemId);
  }, [activeReturnRequest]);

  // Handle select/deselect item for manual POS return
  const toggleSelectItem = (itemId: string) => {
    setSelectedItemIds(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  // Select all items
  const handleSelectAll = () => {
    if (!activeOrder) return;
    const allIds = activeOrder.items.map(item => item.item_id);
    if (selectedItemIds.length === allIds.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(allIds);
    }
  };

  // Update order status directly in backend database
  const handleUpdateStatus = async (status: string, targetOrderId?: string) => {
    const orderIdToUpdate = targetOrderId || selectedOrderId;
    if (!orderIdToUpdate) return;
    setIsProcessing(true);
    try {
      const token = localStorage.getItem("store:token");
      const res = await fetch(`${API_CONFIG.webBackendBaseUrl}/api/admin/orders/${orderIdToUpdate}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error("Status update failed on database");
      
      toast.success(`Order #${orderIdToUpdate} accepted!`);
      await fetchOrdersAndUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to update order status");
    } finally {
      setIsProcessing(false);
    }
  };

  // Update online return request status (Approve / Reject)
  const handleUpdateReturnRequestStatus = async (returnId: string, newStatus: "APPROVED" | "REJECTED") => {
    if (!selectedOrderId) return;
    setIsProcessing(true);
    try {
      const token = localStorage.getItem("store:token");
      
      // 1. Update ReturnRequest Status
      const returnRes = await fetch(`${API_CONFIG.webBackendBaseUrl}/api/admin/return-requests/${returnId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ 
          status: newStatus,
          action: newStatus === "APPROVED" ? "REFUND_IMMEDIATELY" : "REJECT_REFUND"
        })
      });
      if (!returnRes.ok) throw new Error("Failed to update return request record");

      // 2. Update Order Status
      const nextOrderStatus = newStatus === "APPROVED" ? "cancelled" : "delivered";
      const orderRes = await fetch(`${API_CONFIG.webBackendBaseUrl}/api/admin/orders/${selectedOrderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ status: nextOrderStatus })
      });
      if (!orderRes.ok) throw new Error("Failed to update order status to cancelled/delivered");

      toast.success(newStatus === "APPROVED" ? "Return request approved successfully!" : "Return request rejected.");
      await fetchOrdersAndUsers();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error processing return status change");
    } finally {
      setIsProcessing(false);
    }
  };

  // Process manual POS return submission
  const handleProcessReturn = async () => {
    if (!selectedOrderId || selectedItemIds.length === 0 || !activeOrder) return;

    setIsProcessing(true);

    try {
      const token = localStorage.getItem("store:token");

      // Map reason to Backend's expected enum value
      let backendReason = "OTHER";
      if (returnReason === "wrong_size") backendReason = "WRONG_SIZE";
      else if (returnReason === "damaged") backendReason = "DAMAGED_ITEM";
      else if (returnReason === "wrong_item") backendReason = "WRONG_ITEM";
      else if (returnReason === "mind_change") backendReason = "CHANGED_MIND";

      // Build list of return items
      const returnItems = activeOrder.items
        .filter(item => selectedItemIds.includes(item.item_id))
        .map(item => ({
          itemId: item.item_id,
          productId: item.product_id,
          quantity: item.quantity || 1,
          price: item.price
        }));

      // Create Return Request payload
      const returnRequestPayload = {
        orderId: selectedOrderId,
        userId: activeOrder.user_id,
        type: "RETURN",
        reason: backendReason,
        status: "APPROVED",
        action: "REFUND_IMMEDIATELY",
        paymentMethodId: refundMethod,
        items: returnItems
      };

      // Post Return Request
      const returnRes = await fetch(`${API_CONFIG.webBackendBaseUrl}/api/admin/return-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(returnRequestPayload)
      });

      if (!returnRes.ok) {
        throw new Error("Failed to submit POS return request to backend");
      }

      // Update Order Status to "cancelled" (indicating refund/returned)
      const statusRes = await fetch(`${API_CONFIG.webBackendBaseUrl}/api/admin/orders/${selectedOrderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ status: "cancelled" })
      });

      if (!statusRes.ok) {
        throw new Error("Failed to set order status to cancelled");
      }

      toast.success(`POS Return & Refund processed successfully for order #${selectedOrderId}`);
      setShowReturnPanel(false);
      await fetchOrdersAndUsers();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to process POS return");
    } finally {
      setIsProcessing(false);
    }
  };

  // Compute stats for KPI cards
  const stats = useMemo(() => {
    const list = Object.values(orders);
    const total = list.length;
    const pending = list.filter(o => o.status === "pending" || o.status === "processed").length;
    const delivered = list.filter(o => o.status === "delivered").length;
    const cancelled = list.filter(o => o.status === "cancelled" || o.status === "returned").length;
    
    // Sum total revenues
    const revenue = list
      .filter(o => o.status !== "cancelled")
      .reduce((sum, o) => sum + o.total, 0);

    return { total, pending, delivered, cancelled, revenue };
  }, [orders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return Object.values(orders).filter(order => {
      // Search term match
      const matchesSearch = 
        order.order_id.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Status filter match
      let matchesStatus = true;
      if (statusFilter !== "all") {
        matchesStatus = order.status === statusFilter;
      }

      return matchesSearch && matchesStatus;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders, searchQuery, statusFilter]);

  // English USD currency formatter
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(price);
  };

  // Reset checkboxes on order change
  useEffect(() => {
    setSelectedItemIds([]);
    setShowReturnPanel(false);
  }, [selectedOrderId]);

  // Compute refund total
  const refundTotal = useMemo(() => {
    if (!activeOrder) return 0;
    return activeOrder.items
      .filter(item => selectedItemIds.includes(item.item_id))
      .reduce((sum, item) => sum + item.price, 0);
  }, [activeOrder, selectedItemIds]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 font-sans admin-theme text-slate-800">
      <Toaster />
      <div className="mx-auto max-w-7xl flex flex-col gap-6">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-100 p-6 rounded-3xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-2xl">
              <ShoppingBag className="size-6" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                <span>Orders Management Portal</span>
                {loading && <RefreshCw className="size-4 animate-spin text-indigo-500" />}
              </h1>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Cashier and sales representative dashboard to process online orders, ship packages, and manage returns.
              </p>
            </div>
          </div>
          <button 
            onClick={fetchOrdersAndUsers}
            className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-black px-4 py-2.5 rounded-xl border-none cursor-pointer transition-all self-start sm:self-center"
          >
            <RefreshCw className="size-3.5" />
            <span>Refresh Data</span>
          </button>
        </div>

        {/* Sales KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white border-slate-100 shadow-3xs rounded-2xl p-4.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Orders</span>
              <div className="bg-indigo-50 text-indigo-600 p-1.5 rounded-lg">
                <ShoppingBag className="size-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-800">{stats.total}</span>
              <span className="text-[10px] text-slate-400 font-bold">orders</span>
            </div>
          </Card>

          <Card className="bg-white border-slate-100 shadow-3xs rounded-2xl p-4.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Pending Processing</span>
              <div className="bg-amber-50 text-amber-600 p-1.5 rounded-lg">
                <Clock className="size-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-800">{stats.pending}</span>
              <span className="text-[10px] text-slate-400 font-bold">orders</span>
            </div>
          </Card>

          <Card className="bg-white border-slate-100 shadow-3xs rounded-2xl p-4.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Delivered Orders</span>
              <div className="bg-emerald-50 text-emerald-600 p-1.5 rounded-lg">
                <Truck className="size-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-800">{stats.delivered}</span>
              <span className="text-[10px] text-slate-400 font-bold">orders</span>
            </div>
          </Card>

          <Card className="bg-white border-slate-100 shadow-3xs rounded-2xl p-4.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">POS Revenues</span>
              <div className="bg-blue-50 text-blue-600 p-1.5 rounded-lg">
                <TrendingUp className="size-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="text-lg font-black text-slate-800">{formatPrice(stats.revenue)}</span>
            </div>
          </Card>
        </div>

        {/* Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left panel: Orders list */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <Card className="bg-white border-slate-100 shadow-2xs rounded-2xl overflow-hidden text-left">
              <CardHeader className="pb-3 border-b border-slate-50 gap-3">
                <CardTitle className="text-sm font-bold text-slate-800">
                  Orders List
                </CardTitle>
                
                {/* Search */}
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search order ID..."
                    className="w-full bg-slate-50 border border-slate-200 pl-9 pr-4 py-2 text-xs rounded-xl outline-none focus:border-indigo-500 transition-all font-medium text-slate-800"
                  />
                </div>

                {/* Status Filters */}
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {(["all", "pending", "processed", "delivered", "return requested", "exchange requested", "cancelled"] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-2.5 py-1 text-[9px] font-bold rounded-lg uppercase tracking-wider transition-all border border-transparent cursor-pointer ${
                        statusFilter === status
                          ? "bg-slate-900 text-white"
                          : "bg-slate-50 text-slate-655 hover:bg-slate-100 hover:text-slate-950"
                      }`}
                    >
                      {status === "all" ? "All" : 
                       status === "pending" ? "Pending" :
                       status === "processed" ? "Processed" :
                       status === "delivered" ? "Delivered" :
                       status === "return requested" ? "Return Req" :
                       status === "exchange requested" ? "Exchange Req" :
                       "Cancelled/Returned"}
                    </button>
                  ))}
                </div>
              </CardHeader>

              <CardContent className="p-0 max-h-[550px] overflow-y-auto divide-y divide-slate-50">
                {loading ? (
                  <div className="py-24 text-center text-xs text-slate-400 font-medium flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="size-6 text-indigo-500 animate-spin" />
                    <span>Loading orders from server...</span>
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="py-20 text-center text-xs text-slate-400 font-medium flex flex-col items-center justify-center gap-2">
                    <Inbox className="size-8 text-slate-200" />
                    No orders found
                  </div>
                ) : (
                  filteredOrders.map(order => {
                    const isSelected = selectedOrderId === order.order_id;
                    return (
                      <div
                        key={order.order_id}
                        onClick={() => setSelectedOrderId(order.order_id)}
                        className={`w-full text-left p-4 transition-colors flex items-center justify-between gap-4 border-none cursor-pointer ${
                          isSelected ? "bg-indigo-50/50" : "hover:bg-slate-50/40"
                        }`}
                      >
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="font-mono text-xs font-bold text-slate-800 truncate">
                            {order.order_id}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {order.date} • {order.items.length} items
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className="text-xs font-bold text-slate-800">
                            {formatPrice(order.total)}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                              order.status === "delivered"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : order.status === "pending"
                                ? "bg-amber-50 text-amber-700 border-amber-100"
                                : order.status === "processed"
                                ? "bg-blue-50 text-blue-700 border-blue-100"
                                : order.status === "cancelled" || order.status === "returned"
                                ? "bg-slate-100 text-slate-600 border-slate-200"
                                : "bg-indigo-50 text-indigo-700 border-indigo-100"
                            }`}>
                              {order.status === "pending" ? "Pending" :
                               order.status === "processed" ? "Processed" :
                               order.status === "delivered" ? "Delivered" :
                               order.status === "cancelled" ? "Cancelled" :
                               order.status}
                            </span>
                            {order.status === "pending" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateStatus("processed", order.order_id);
                                }}
                                disabled={isProcessing}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-[8px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border-none cursor-pointer transition-all shadow-3xs"
                              >
                                Accept
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right panel: Detail & Return handler */}
          <div className="lg:col-span-7">
            {activeOrder ? (
              <div className="flex flex-col gap-6 text-left">
                
                {/* Customer & Order metadata card */}
                <Card className="bg-white border-slate-100 shadow-2xs rounded-2xl p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Order Details
                    </span>
                    <span className="text-xs font-mono font-bold text-indigo-600">
                      {activeOrder.order_id}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* User profile details */}
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center gap-2 text-slate-800 font-bold mb-1">
                        <User className="size-4 text-slate-400" />
                        <span>Customer Profile</span>
                      </div>
                      <div className="pl-6 flex flex-col gap-1 text-slate-655 font-medium">
                        <span className="font-semibold text-slate-800">
                          {activeUser ? `${activeUser.first_name} ${activeUser.last_name}` : "Guest / In-Store Purchase"}
                        </span>
                        <span>{activeUser?.email || "No email available"}</span>
                      </div>
                    </div>

                    {/* Shipping Address */}
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center gap-2 text-slate-800 font-bold mb-1">
                        <MapPin className="size-4 text-slate-400" />
                        <span>Shipping Address</span>
                      </div>
                      <div className="pl-6 flex flex-col gap-1 text-slate-655 font-medium">
                        <span>{activeOrder.address?.address1 || "In-Store Pickup / POS"}</span>
                        <span>{activeOrder.address?.city || ""}, {activeOrder.address?.state || ""}</span>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Items selection / viewing card */}
                <Card className="bg-white border-slate-100 shadow-2xs rounded-2xl overflow-hidden">
                  <CardHeader className="pb-3 border-b border-slate-50 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-800">
                        {showReturnPanel ? "Select Items to Return" : "Purchased Items"}
                      </CardTitle>
                      {showReturnPanel && (
                        <CardDescription className="text-[11px] text-slate-400 font-semibold mt-0.5">
                          Check items to return and calculate POS refund amount
                        </CardDescription>
                      )}
                    </div>
                    {showReturnPanel && (
                      <button
                        onClick={handleSelectAll}
                        className="text-xs font-black text-indigo-650 hover:text-indigo-800 bg-none border-none cursor-pointer"
                      >
                        {selectedItemIds.length === activeOrder.items.length ? "Deselect All" : "Select All"}
                      </button>
                    )}
                  </CardHeader>

                  <CardContent className="p-0 divide-y divide-slate-50">
                    {activeOrder.items.map((item) => {
                      const isSelected = selectedItemIds.includes(item.item_id);
                      const isReturned = isItemReturned(item.item_id);
                      return (
                        <div 
                          key={item.item_id} 
                          onClick={() => showReturnPanel && !isReturned && toggleSelectItem(item.item_id)}
                          className={`p-4 flex items-center justify-between gap-4 select-none ${
                            showReturnPanel && !isReturned ? "cursor-pointer hover:bg-slate-50/30" : ""
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {showReturnPanel && (
                              <div className={`size-4.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                                isReturned 
                                  ? "bg-slate-100 border-slate-200 text-slate-350 cursor-not-allowed"
                                  : isSelected 
                                  ? "bg-indigo-600 border-indigo-600 text-white" 
                                  : "border-slate-300 bg-white"
                              }`}>
                                {isSelected && !isReturned && <Check className="size-3 stroke-[3]" />}
                              </div>
                            )}
                            {/* Product Image Thumbnail */}
                            <div className="h-11 w-11 rounded-md bg-slate-50 border overflow-hidden flex items-center justify-center shrink-0 text-slate-400">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.name} className="h-full w-full object-contain" />
                              ) : (
                                <span className="text-[9px] font-bold text-center leading-tight uppercase p-1">No Image</span>
                              )}
                            </div>
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="font-bold text-xs text-slate-800 truncate flex items-center gap-1.5">
                                <span>{item.name}</span>
                                {isReturned && (
                                  <span className="bg-amber-50 text-amber-700 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 border border-amber-100 animate-pulse">
                                    Return Requested
                                  </span>
                                )}
                              </span>
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block truncate">
                                {Object.entries(item.options || {}).map(([k, v]) => `${k}: ${v}`).join(" | ")}
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold block">
                                Qty: x{item.quantity}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-slate-800 shrink-0">
                            {formatPrice(item.price)}
                          </span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* Operations & POS Actions Panel */}
                {!showReturnPanel && (
                  <Card className="bg-white border-slate-100 shadow-2xs rounded-2xl p-5 flex flex-col gap-4 animate-in fade-in duration-200">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Sales Representative Operations
                    </span>
                    
                    {/* Render online return request details if present */}
                    {activeReturnRequest && (activeOrder.status === "return requested" || activeOrder.status === "exchange requested") && (
                      <div className="bg-amber-50/40 border border-amber-150 p-4.5 rounded-2xl space-y-3 mb-2 text-xs">
                        <div className="flex items-center gap-2 border-b border-amber-100 pb-2">
                          <RotateCcw className="size-4.5 text-amber-600 animate-spin" style={{ animationDuration: '3s' }} />
                          <span className="font-black text-amber-800">
                            Pending Online Return & Refund Request
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 font-medium text-slate-700">
                          <div>Reason: <span className="font-bold text-slate-800 capitalize">{activeReturnRequest.reason}</span></div>
                          <div>Refund Method: <span className="font-bold text-slate-800 capitalize">{activeReturnRequest.paymentMethodId}</span></div>
                          <div className="col-span-2 border-t border-amber-100/50 pt-2 mt-1 flex justify-between items-center text-sm font-extrabold text-amber-900">
                            <span>Calculated Refund Amount:</span>
                            <span>{formatPrice(activeReturnRequest.items?.reduce((sum: number, i: any) => sum + (i.price * (i.quantity || 1)), 0) || 0)}</span>
                          </div>
                        </div>

                        {/* Approve/Reject return request buttons */}
                        <div className="flex gap-2 pt-2 border-t border-amber-100">
                          <Button
                            onClick={() => handleUpdateReturnRequestStatus(activeReturnRequest.returnId, "REJECTED")}
                            disabled={isProcessing}
                            className="w-1/2 bg-white hover:bg-slate-50 text-slate-655 border border-slate-200 rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer"
                          >
                            Reject
                          </Button>
                          <Button
                            onClick={() => handleUpdateReturnRequestStatus(activeReturnRequest.returnId, "APPROVED")}
                            disabled={isProcessing}
                            className="w-1/2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border-none"
                          >
                            <CheckCircle2 className="size-4" />
                            <span>Accept</span>
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Standard Order Lifecycle buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Accept button (pending -> processed) */}
                      {activeOrder.status === "pending" && (
                        <Button
                          onClick={() => handleUpdateStatus("processed")}
                          disabled={isProcessing}
                          className="bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl py-3 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border-none"
                        >
                          <Package className="size-4" />
                          <span>Accept</span>
                        </Button>
                      )}

                      {/* Deliver button (processed -> delivered) */}
                      {activeOrder.status === "processed" && (
                        <Button
                          onClick={() => handleUpdateStatus("delivered")}
                          disabled={isProcessing}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border-none"
                        >
                          <Truck className="size-4" />
                          <span>Confirm Delivery</span>
                        </Button>
                      )}

                      {/* POS return triggers (only if delivered and no request or we want manual action) */}
                      {activeOrder.status === "delivered" && (
                        <Button
                          onClick={() => {
                            setSelectedItemIds([]);
                            setShowReturnPanel(true);
                          }}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl py-3 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer border border-amber-200"
                        >
                          <RotateCcw className="size-4" />
                          <span>Process POS Return</span>
                        </Button>
                      )}

                      {/* Cancel button (pending / processed -> cancelled) */}
                      {(activeOrder.status === "pending" || activeOrder.status === "processed") && (
                        <Button
                          onClick={() => handleUpdateStatus("cancelled")}
                          disabled={isProcessing}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-3 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border-none"
                        >
                          <XCircle className="size-4 text-slate-500" />
                          <span>Cancel Order</span>
                        </Button>
                      )}
                    </div>
                  </Card>
                )}

                {/* Return settings form */}
                {showReturnPanel && (
                  <Card className="bg-white border-slate-100 shadow-2xs rounded-2xl p-5 flex flex-col gap-5 animate-in fade-in duration-200">
                    <div className="flex justify-between items-center border-b border-slate-50 pb-2.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        POS Return & Refund Configuration
                      </span>
                      <button 
                        onClick={() => setShowReturnPanel(false)}
                        className="text-xs font-bold text-slate-400 hover:text-slate-655 bg-transparent border-none cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>

                    {selectedItemIds.length === 0 ? (
                      <div className="bg-amber-50/40 border border-amber-100 p-5 rounded-2xl flex items-center gap-3 text-left">
                        <AlertCircle className="size-5 text-amber-600 shrink-0" />
                        <span className="text-xs text-amber-700 font-semibold">
                          Please select at least one item above to configure return options.
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                          {/* Reason */}
                          <div className="flex flex-col gap-2">
                            <label className="font-bold text-slate-700">Return Reason</label>
                            <select 
                              value={returnReason}
                              onChange={(e) => setReturnReason(e.target.value)}
                              className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-semibold text-slate-800 outline-none focus:border-indigo-500 transition-all cursor-pointer"
                            >
                              <option value="wrong_size">Wrong Size</option>
                              <option value="damaged">Damaged/Defective Item</option>
                              <option value="wrong_item">Incorrect Item Shipped</option>
                              <option value="mind_change">Customer Mind Change</option>
                              <option value="other">Other Reason</option>
                            </select>
                          </div>

                          {/* Refund Method */}
                          <div className="flex flex-col gap-2">
                            <label className="font-bold text-slate-700">Refund Method</label>
                            <select 
                              value={refundMethod}
                              onChange={(e) => setRefundMethod(e.target.value)}
                              className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-semibold text-slate-800 outline-none focus:border-indigo-500 transition-all cursor-pointer"
                            >
                              <option value="original">Original Payment Account</option>
                              <option value="cash">Cash Refund</option>
                              <option value="store_credit">Store Credit / Points</option>
                            </select>
                          </div>

                          {/* Inventory toggle */}
                          <div className="flex items-center gap-3 bg-slate-50/50 border border-slate-100 p-3 rounded-xl sm:col-span-2">
                            <input
                              type="checkbox"
                              id="inv-toggle"
                              checked={returnToInventory}
                              onChange={(e) => setReturnToInventory(e.target.checked)}
                              className="size-4.5 rounded border-slate-300 text-indigo-650 focus:ring-indigo-550 cursor-pointer accent-indigo-600"
                            />
                            <label htmlFor="inv-toggle" className="font-bold text-slate-700 select-none cursor-pointer flex flex-col gap-0.5">
                              <span>Auto-restock inventory</span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                Automatically add returned item quantities back to active shop catalog.
                              </span>
                            </label>
                          </div>
                        </div>

                        {/* Refund Summary and submit */}
                        <div className="border-t border-slate-100 pt-4 flex flex-col gap-4">
                          <div className="flex justify-between items-center text-sm font-extrabold text-slate-800">
                            <span>Calculated Refund Total</span>
                            <span className="text-indigo-600 text-base">{formatPrice(refundTotal)}</span>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              onClick={() => setShowReturnPanel(false)}
                              className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-3 text-xs font-bold transition-all cursor-pointer border-none"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handleProcessReturn}
                              disabled={isProcessing}
                              className="w-2/3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs py-3 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border-none"
                            >
                              {isProcessing ? (
                                <>
                                  <RefreshCw className="size-4 animate-spin" />
                                  <span>Processing...</span>
                                </>
                              ) : (
                                <>
                                  <Check className="size-4" />
                                  <span>Process POS Refund</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </Card>
                )}
              </div>
            ) : (
              <div className="bg-white border border-slate-100 rounded-3xl p-16 shadow-2xs text-center flex flex-col items-center justify-center gap-3 min-h-[500px]">
                <Package className="size-12 text-slate-200 animate-bounce" />
                <p className="text-slate-500 font-bold text-sm">
                  Select an Order to Start
                </p>
                <span className="text-xs text-slate-400 max-w-[280px] font-medium leading-relaxed">
                  Click on any order from the left list to review its items, fulfill status, or trigger returns.
                </span>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
