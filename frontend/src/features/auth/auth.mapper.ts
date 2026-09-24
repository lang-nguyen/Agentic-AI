import type { UserProfile } from "@/types/store";

export function mapUser(userData: any): UserProfile {
  return {
    id: userData.id,
    first_name: userData.name?.firstName || userData.fullName?.split(" ")[0],
    last_name: userData.name?.lastName || userData.fullName?.split(" ")[1],
    email: userData.email,
    address: userData.address,
    payment_methods: Object.values(userData.paymentMethods || {}).map((pm: any) => ({
      id: pm.id,
      source: pm.source,
      brand: pm.brand,
      last_four: pm.last_four
    })),
    orders: userData.orders
  };
}
