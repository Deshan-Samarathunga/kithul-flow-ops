import { createContext, useContext, useEffect, useMemo, useState } from "react";

type User = { id: number; email: string; name?: string | null };
type AuthState = { user: User | null; token: string | null };
type AuthContext = AuthState & {
  login: (payload: { email: string; password: string }) => Promise<void>;
  logout: () => void;
};

const AuthCtx = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("auth");
    if (saved) {
      const { user, token } = JSON.parse(saved) as AuthState;
      setUser(user);
      setToken(token);
    }
  }, []);

  async function login({ email, password }: { email: string; password: string }) {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error("Invalid credentials");
    const data = (await res.json()) as { token: string; user: User };
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("auth", JSON.stringify({ user: data.user, token: data.token }));
  }

  function logout() {
    setUser(null);
    setToken(null);
    localStorage.removeItem("auth");
  }

  const value = useMemo(() => ({ user, token, login, logout }), [user, token]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
