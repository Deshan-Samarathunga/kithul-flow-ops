const API = import.meta.env.VITE_API_URL;

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const saved = localStorage.getItem("auth");
  const fallbackToken = saved ? (JSON.parse(saved).token as string) : null;

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token || fallbackToken ? { Authorization: `Bearer ${token || fallbackToken}` } : {}),
    },
  });
  if (res.status === 401) {
    // kill session locally
    localStorage.removeItem("auth");
  }
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg || `HTTP ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export type AdminUser = {
  id: number;
  userId: string;
  name?: string | null;
  role: string;
  isActive: boolean;
  profileImage?: string | null;
};

export async function adminListUsers() {
  const data = await apiFetch<{ users: AdminUser[] }>("/api/admin/users");
  return data.users;
}

export async function adminGetUser(id: number) {
  return apiFetch<AdminUser>(`/api/admin/users/${id}`);
}

export async function adminUpdateUser(
  id: number,
  payload: { name?: string; role?: string; isActive?: boolean },
) {
  return apiFetch<AdminUser>(`/api/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function adminDeleteUser(id: number) {
  await apiFetch<undefined>(`/api/admin/users/${id}`, {
    method: "DELETE",
  });
}

export type AdminCenter = {
  id: number;
  centerId: string;
  centerName: string;
  location: string;
  centerAgent: string;
  contactPhone?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function adminListCenters() {
  const data = await apiFetch<{ centers: AdminCenter[] }>("/api/admin/centers");
  return data.centers;
}

export async function adminGetCenter(id: number) {
  return apiFetch<AdminCenter>(`/api/admin/centers/${id}`);
}

export async function adminCreateCenter(payload: {
  centerId: string;
  centerName: string;
  location: string;
  centerAgent: string;
  contactPhone?: string;
}) {
  return apiFetch<AdminCenter>("/api/admin/centers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function adminUpdateCenter(
  id: number,
  payload: {
    centerName?: string;
    location?: string;
    centerAgent?: string;
    contactPhone?: string;
    isActive?: boolean;
  },
) {
  return apiFetch<AdminCenter>(`/api/admin/centers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function adminDeleteCenter(id: number) {
  await apiFetch<undefined>(`/api/admin/centers/${id}`, {
    method: "DELETE",
  });
}
