import type { Order } from "@/types/store";

export function mapOrders(data: any[]): Order[] {
  if (!data) return [];
  return data.map((rawOrder: any) => ({
    order_id: rawOrder.orderId,
    status: rawOrder.status || "pending",
    address: {
      address1: rawOrder.address?.address1 || "123 Order Street",
      city: rawOrder.address?.city || "Order City",
      state: rawOrder.address?.state || "OD",
      zip: rawOrder.address?.zip || "00000",
      country: rawOrder.address?.country || "USA"
    },
    items: (rawOrder.items || []).map((item: any) => ({
      name: item.name,
      product_id: item.productId,
      item_id: item.itemId,
      price: item.price,
      options: item.options || {}
    })),
    total: rawOrder.total || 0,
    date: rawOrder.date || "2026-08-05 12:00 EST"
  }));
}
