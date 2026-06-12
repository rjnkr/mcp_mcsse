import { getAccessToken } from "./auth.js";

// ── Auth error ────────────────────────────────────────────────────────────────

const PORT = process.env.PORT ?? "3000";

function handleAuthError(status: number, path: string, body: string): never {
  console.error(`[Auth] ${status} on ${path} — session invalid or expired. Visit http://localhost:${PORT}/login to re-authenticate.`);
  throw new Error(
    `Not authenticated (${status}): your session with the MCSSE backend is invalid or has expired. ` +
    `Please log in again at http://localhost:${PORT}/login.`,
  );
}

// ── MCP response helpers ──────────────────────────────────────────────────────

export function toText(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function buildQuery(params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      for (const item of v) qs.append(k, String(item));
    } else {
      qs.set(k, String(v));
    }
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export function result(data: unknown) {
  return { content: [{ type: "text" as const, text: toText(data) }] };
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

const MCSSE_API_URL= process.env.MCSSE_API_URL ?? "mcsse url missing in config";

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${MCSSE_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string> | undefined),
    },
  });
}

export async function apiGet(path: string): Promise<unknown> {
  const res = await apiFetch(path);
  if (res.status === 204) return null;
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401 || res.status === 403) handleAuthError(res.status, path, text);
    const msg = `API error ${res.status}: ${text}`;
    console.error(`[GET ${path}] ${msg}`);
    throw new Error(msg);
  }
  return res.json();
}

export async function apiPost(path: string, body: unknown): Promise<unknown> {
  const res = await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
  if (res.status === 201 || res.status === 200) {
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  const text = await res.text();
  if (res.status === 401 || res.status === 403) handleAuthError(res.status, path, text);
  const msg = `API error ${res.status}: ${text}`;
  console.error(`[POST ${path}] ${msg}`);
  throw new Error(msg);
}

export async function apiPut(path: string, body: unknown): Promise<unknown> {
  const res = await apiFetch(path, { method: "PUT", body: JSON.stringify(body) });
  if (res.status === 201 || res.status === 200) {
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  const text = await res.text();
  if (res.status === 401 || res.status === 403) handleAuthError(res.status, path, text);
  const msg = `API error ${res.status}: ${text}`;
  console.error(`[PUT ${path}] ${msg}`);
  throw new Error(msg);
}

export async function apiPatch(path: string, body?: unknown): Promise<unknown> {
  const res = await apiFetch(path, {
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 201 || res.status === 200 || res.status === 204) {
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  const text = await res.text();
  if (res.status === 401 || res.status === 403) handleAuthError(res.status, path, text);
  const msg = `API error ${res.status}: ${text}`;
  console.error(`[PATCH ${path}] ${msg}`);
  throw new Error(msg);
}

export async function apiDelete(path: string): Promise<void> {
  const res = await apiFetch(path, { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401 || res.status === 403) handleAuthError(res.status, path, text);
    const msg = `API error ${res.status}: ${text}`;
    console.error(`[DELETE ${path}] ${msg}`);
    throw new Error(msg);
  }
}
