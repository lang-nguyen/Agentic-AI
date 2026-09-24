import usersData from "@/data/users.json";
import ordersData from "@/data/orders.json";
import productsData from "@/data/products.json";

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
  quantity?: number;
}

export interface Order {
  order_id: string;
  status: "pending" | "processed" | "delivered" | "cancelled" | "return requested" | "exchange requested";
  address: Address;
  items: OrderItem[];
  total: number;
  date: string;
  user_id?: string;
  fulfillments?: {
    tracking_id: string[];
  }[];
  payment_history?: {
    transaction_type: string;
    payment_method_id: string;
    amount: number;
  }[];
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  rating: number;
  reviews: number;
  description: string;
  gradient: string;
}

// Map category based on product name
function getProductCategory(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("shirt") || n.includes("hoodie") || n.includes("jacket") || n.includes("shorts") || n.includes("pants")) {
    return "Apparel";
  }
  if (n.includes("shoes") || n.includes("boots") || n.includes("sneakers") || n.includes("loafers")) {
    return "Footwear";
  }
  if (n.includes("laptop") || n.includes("phone") || n.includes("watch") || n.includes("earbuds") || n.includes("camera") || n.includes("keyboard") || n.includes("mouse") || n.includes("kettle") || n.includes("bulb")) {
    return "Electronics";
  }
  if (n.includes("backpack") || n.includes("wallet") || n.includes("sunglasses")) {
    return "Accessories";
  }
  return "Home & Outdoor";
}

// Generate consistent gradient based on name string
function getProductGradient(name: string): string {
  const gradients = [
    "from-amber-600 to-amber-900",
    "from-blue-600 to-indigo-900",
    "from-slate-655 to-slate-800",
    "from-rose-900 to-rose-950",
    "from-emerald-600 to-emerald-950",
    "from-violet-600 to-purple-950",
    "from-cyan-600 to-blue-900",
    "from-teal-650 to-emerald-900",
    "from-stone-600 to-stone-900",
    "from-purple-650 to-indigo-950"
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

// Generate consistent rating and review count
function getProductMetadata(id: string): { rating: number; reviews: number } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const rating = 4.0 + (Math.abs(hash) % 10) / 10;
  const reviews = 20 + (Math.abs(hash) % 450);
  return { rating: parseFloat(rating.toFixed(1)), reviews };
}

// 1. Process and export products from products.json
export const MOCK_PRODUCTS: Product[] = Object.keys(productsData).map((productId) => {
  const rawProd = (productsData as any)[productId];
  
  // Get first variant price or default
  let price = 49.99;
  if (rawProd.variants) {
    const firstVariantKey = Object.keys(rawProd.variants)[0];
    if (firstVariantKey) {
      price = rawProd.variants[firstVariantKey].price || price;
    }
  }

  const { rating, reviews } = getProductMetadata(productId);

  return {
    id: productId,
    name: rawProd.name,
    price: parseFloat(price.toFixed(2)),
    category: getProductCategory(rawProd.name),
    rating,
    reviews,
    description: rawProd.display_name || `${rawProd.name} with premium features and customization options.`,
    gradient: getProductGradient(rawProd.name)
  };
});

// 2. Process and export users from users.json
export const MOCK_USERS: Record<string, UserProfile> = {};
Object.keys(usersData).forEach((userId) => {
  const rawUser = (usersData as any)[userId];
  
  const paymentMethods: PaymentMethod[] = [];
  if (rawUser.payment_methods) {
    Object.keys(rawUser.payment_methods).forEach((key) => {
      const pm = rawUser.payment_methods[key];
      paymentMethods.push({
        id: pm.id || key,
        source: pm.source,
        brand: pm.brand,
        last_four: pm.last_four
      });
    });
  }

  MOCK_USERS[userId] = {
    id: userId,
    first_name: rawUser.name?.first_name || "User",
    last_name: rawUser.name?.last_name || userId,
    email: rawUser.email,
    address: rawUser.address || {
      address1: "123 Default Street",
      city: "Default City",
      state: "DF",
      zip: "00000",
      country: "USA"
    },
    payment_methods: paymentMethods,
    orders: rawUser.orders || []
  };
});

// 3. Process and export orders from orders.json
export const MOCK_ORDERS: Record<string, Order> = {};
Object.keys(ordersData).forEach((orderId) => {
  const rawOrder = (ordersData as any)[orderId];
  
  const items: OrderItem[] = (rawOrder.items || []).map((item: any) => ({
    name: item.name,
    product_id: item.product_id,
    item_id: item.item_id,
    price: parseFloat((item.price || 0).toFixed(2)),
    options: item.options || {}
  }));

  const total = items.reduce((sum, item) => sum + item.price, 0);

  MOCK_ORDERS[orderId] = {
    order_id: orderId,
    status: rawOrder.status || "pending",
    address: rawOrder.address || {
      address1: "123 Order Street",
      city: "Order City",
      state: "OD",
      zip: "00000",
      country: "USA"
    },
    items,
    total: parseFloat(total.toFixed(2)),
    date: rawOrder.date || "2026-08-05 12:00 EST"
  };
});
