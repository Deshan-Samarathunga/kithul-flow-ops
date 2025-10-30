import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

type User = {
  id: number;
  userId: string;
  name?: string | null;
  role?: string;
  profileImage?: string | null;
};

type AuthState = { user: User | null; token: string | null };
type AuthContext = AuthState & {
  login: (payload: { userId: string; password: string }) => Promise<User>;
  logout: () => void;
  updateUser: (user: User | null) => void;
  hydrated: boolean;
};

const AuthCtx = createContext<AuthContext | null>(null);

function normalizeUser(data: any | null | undefined): User | null {
  if (!data) return null;
  const normalizedUserId = data.userId ?? data.user_id ?? data.username;
  if (!normalizedUserId) {
    throw new Error("Invalid user payload: missing userId");
  }

  const userId = String(normalizedUserId).trim();
  if (!userId) {
    throw new Error("Invalid user payload: empty userId");
  }

  return {
    id: Number(data.id),
    userId,
    name: data.name ?? null,
    role: data.role ?? null,
    profileImage: data.profileImage ?? data.profile_image ?? null,
  };
}

function loadSavedAuth(): AuthState {
  const saved = localStorage.getItem("auth");
  if (!saved) return { user: null, token: null };
  try {
    const parsed = JSON.parse(saved) as AuthState;
    const normalizedUser = normalizeUser(parsed.user);
    return { user: normalizedUser, token: parsed.token ?? null };
  } catch {
    localStorage.removeItem("auth");
    return { user: null, token: null };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [{ initialUser, initialToken }] = useState(() => {
    const { user, token } = loadSavedAuth();
    return { initialUser: user, initialToken: token };
  });

  const [user, setUser] = useState<User | null>(initialUser);
  const [token, setToken] = useState<string | null>(initialToken);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      sessionStorage.setItem("userName", user.name || user.userId);
      sessionStorage.setItem("userRole", user.role || "");
      sessionStorage.setItem("userId", user.userId);
    } else {
      sessionStorage.removeItem("userName");
      sessionStorage.removeItem("userRole");
      sessionStorage.removeItem("userId");
    }
  }, [user]);

  useEffect(() => {
    if (!token) {
      setHydrated(true);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const r = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) throw new Error("unauthorized");
        const me = await r.json();
        const freshUser = normalizeUser(me);
        if (cancelled) return;
        setUser(freshUser);
        if (freshUser) {
          localStorage.setItem("auth", JSON.stringify({ user: freshUser, token }));
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setToken(null);
          localStorage.removeItem("auth");
          sessionStorage.clear();
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function login({ userId, password }: { userId: string; password: string }) {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, password }),
    });
    if (!res.ok) throw new Error("Invalid credentials");
    const data = (await res.json()) as { token: string; user: unknown };
    const normalizedUser = normalizeUser(data.user);
    if (!normalizedUser) throw new Error("Invalid user response");
    setUser(normalizedUser);
    setToken(data.token);
    localStorage.setItem("auth", JSON.stringify({ user: normalizedUser, token: data.token }));
    return normalizedUser;
  }

  const updateUser = useCallback(
    (next: User | null) => {
      setUser(next);
      if (next && (token || localStorage.getItem("auth"))) {
        const authToken =
          token ?? JSON.parse(localStorage.getItem("auth") || "{}")?.token ?? null;
        if (authToken) {
          localStorage.setItem("auth", JSON.stringify({ user: next, token: authToken }));
        }
      } else if (!next) {
        localStorage.removeItem("auth");
      }
    },
    [token]
  );

  function logout() {
    setUser(null);
    setToken(null);
    setHydrated(true);
    localStorage.removeItem("auth");
    sessionStorage.clear();
  }

  const value = useMemo(
    () => ({ user, token, login, logout, updateUser, hydrated }),
    [user, token, updateUser, hydrated]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
