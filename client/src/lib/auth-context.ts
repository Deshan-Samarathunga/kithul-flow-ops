import { createContext } from "react";

export type User = {
  id: number;
  userId: string;
  name?: string | null;
  role?: string;
  profileImage?: string | null;
};

export type AuthState = { user: User | null; token: string | null };

export type AuthContext = AuthState & {
  login: (payload: { userId: string; password: string }) => Promise<User>;
  logout: () => void;
  updateUser: (user: User | null) => void;
  hydrated: boolean;
};

export const AuthCtx = createContext<AuthContext | null>(null);
