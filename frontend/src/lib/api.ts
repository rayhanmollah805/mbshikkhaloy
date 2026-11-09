// "/api" = same-origin (behind the tunnel). Use http://localhost:3001/api for split local dev.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export function getToken() {
  return typeof window === "undefined" ? null : localStorage.getItem("token");
}

export function setToken(t: string | null) {
  if (t) localStorage.setItem("token", t);
  else localStorage.removeItem("token");
}

// Callers pass an explicit type where it matters; untyped calls get `any`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function api<T = any>(
  path: string,
  opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: {
      ...(opts.body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) {
      setToken(null);
      if (typeof window !== "undefined") window.location.href = "/login";
    }
    const m = data?.message;
    throw new Error(Array.isArray(m) ? m.join(", ") : (m ?? `Error ${res.status}`));
  }
  return data as T;
}

/** Uploads a PDF or video; returns the server-relative /uploads/... URL. */
export async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_URL}/upload`, {
    method: "POST",
    headers: { authorization: `Bearer ${getToken()}` },
    body: fd,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message ?? "Upload failed");
  return data.url as string;
}

// Uploads are served at <origin>/uploads. Same-origin when API_URL is relative.
const UPLOAD_ORIGIN = API_URL.startsWith("/") ? "" : new URL(API_URL).origin;
export const fileUrl = (u: string) => (u.startsWith("/uploads/") ? `${UPLOAD_ORIGIN}${u}` : u);
