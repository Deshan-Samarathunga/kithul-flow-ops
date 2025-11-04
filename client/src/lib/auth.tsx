import { useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import { AuthCtx, type AuthContext, type AuthState, type User } from "./auth-context";

const toOptionalString = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }
  return undefined;
};

const toOptionalNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

function normalizeUser(data: unknown): User | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  const normalizedUserId =
    toOptionalString(record.userId) ??
    toOptionalString(record.user_id) ??
    toOptionalString(record.username);
  if (!normalizedUserId) {
    throw new Error("Invalid user payload: missing userId");
  }

  const userId = normalizedUserId.trim();
  if (!userId) {
    throw new Error("Invalid user payload: empty userId");
  }

  const id = toOptionalNumber(record.id) ?? 0;

  return {
    id,
    userId,
    name: toOptionalString(record.name) ?? null,
    role: toOptionalString(record.role) ?? null,
    profileImage:
      toOptionalString(record.profileImage) ?? toOptionalString(record.profile_image) ?? null,
  };
}

function loadSavedAuth(): AuthState {
  const saved = localStorage.getItem("auth");
  if (!saved) return { user: null, token: null };
  try {
    const parsed = JSON.parse(saved) as { user?: unknown; token?: unknown };
    const normalizedUser = normalizeUser(parsed.user);
    return { user: normalizedUser, token: typeof parsed.token === "string" ? parsed.token : null };
  } catch {
    localStorage.removeItem("auth");
    return { user: null, token: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
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
        const authToken = token ?? JSON.parse(localStorage.getItem("auth") || "{}")?.token ?? null;
        if (authToken) {
          localStorage.setItem("auth", JSON.stringify({ user: next, token: authToken }));
        }
      } else if (!next) {
        localStorage.removeItem("auth");
      }
    },
    [token],
  );

  function logout() {
    setUser(null);
    setToken(null);
    setHydrated(true);
    localStorage.removeItem("auth");
    sessionStorage.clear();
    try {
      // Preserve tabs, filters, product types, and searches on logout.
      // Only clear transient dialog open states.
      const dialogKeys = [
        "packaging.reportDialogOpen",
        "packaging.createDialogOpen",
        "labeling.reportDialogOpen",
        "labeling.createDialogOpen",
      ];
      dialogKeys.forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore
    }
  }

  const value = useMemo<AuthContext>(
    () => ({ user, token, login, logout, updateUser, hydrated }),
    [user, token, updateUser, hydrated],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
