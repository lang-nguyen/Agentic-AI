import type { UserProfile } from "@/types/store";

export function mapUser(userData: any): UserProfile {
  return {
    id: userData.id,
    first_name: userData.name?.firstName || userData.fullName?.split(" ")[0] || "User",
    last_name: userData.name?.lastName || userData.fullName?.split(" ")[1] || "Profile",
    email: userData.email,
    address: userData.address || {
      address1: "123 Default Street",
      city: "Default City",
      state: "DF",
      zip: "00000",
      country: "USA"
    },
    payment_methods: Object.values(userData.paymentMethods || {}).map((pm: any) => ({
      id: pm.id || "paypal_default",
      source: pm.source || "paypal",
      brand: pm.brand,
      last_four: pm.last_four
    })),
    orders: userData.orders || []
  };
}
