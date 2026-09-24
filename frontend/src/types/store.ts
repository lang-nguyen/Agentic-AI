export interface Address {
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface PaymentMethod {
  id: string;
  source: "paypal" | "credit_card" | "gift_card";
  brand?: string;
  last_four?: string;
  balance?: number;
}

export interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  address: Address;
  payment_methods: PaymentMethod[];
  orders: string[];
}

export interface OrderItem {
  name: string;
  product_id: string;
  item_id: string;
  price: number;
  options: Record<string, string>;
}

export interface Order {
  order_id: string;
  status: "pending" | "processed" | "delivered" | "cancelled" | "return requested" | "exchange requested";
  address: Address;
  items: OrderItem[];
  total: number;
  date: string;
  fulfillments?: {
    tracking_id: string[];
  }[];
  payment_history?: {
    amount: number;
    payment_method_id: string;
    transaction_type: string;
  }[];
}

export interface ReturnRequestItem {
  itemId: string;
  productId: string;
  name: string;
  quantity: number;
  price: number;
  reason: string;
  customerComment: string | null;
  images: string[];
}

export interface ReturnRequest {
  id: string;
  returnId: string;
  orderId: string;
  userId: string;
  type: "RETURN" | "EXCHANGE";
  reason: string;
  status: "PENDING_PROCESSING" | "APPROVED" | "REJECTED";
  paymentMethodId: string;
  items: ReturnRequestItem[];
  createdAt: string;
  updatedAt: string;
}
