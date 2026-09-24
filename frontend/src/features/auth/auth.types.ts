import type { UserProfile } from "@/types/store";

export interface AuthContextType {
  currentUser: UserProfile | null;
  setCurrentUser: (user: UserProfile | null) => void;
  login: (userKey: string, password?: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
  error: string | null;
  isInitialized: boolean;
}
