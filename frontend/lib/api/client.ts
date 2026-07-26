import { useAuthStore } from "@/stores/auth-store";
import type { ApiError, Tokens } from "@/lib/types/api";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
let refreshPromise: Promise<Tokens | null> | null = null;
export class ApiRequestError extends Error { constructor(public status: number, message: string) { super(message); } }
async function refreshSession(): Promise<Tokens | null> {
  const refreshToken = useAuthStore.getState().tokens?.refresh_token;
  if (!refreshToken) return null;
  const response = await fetch(`${API_URL}/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: refreshToken }) });
  if (!response.ok) { useAuthStore.getState().clear(); return null; }
  const tokens = await response.json() as Tokens; useAuthStore.getState().setSession(tokens); return tokens;
}
export async function authorizedFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const token = useAuthStore.getState().tokens?.access_token;
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (response.status === 401 && retry && useAuthStore.getState().tokens?.refresh_token) {
    refreshPromise ??= refreshSession().finally(() => { refreshPromise = null; });
    if (await refreshPromise) return authorizedFetch(path, init, false);
  }
  return response;
}

export async function apiErrorFromResponse(response: Response): Promise<ApiRequestError> {
  const body = await response.json().catch(() => ({})) as ApiError;
  const message = typeof body.detail === "string" ? body.detail : body.detail?.[0]?.msg ?? "Something went wrong";
  return new ApiRequestError(response.status, message);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await authorizedFetch(path, init);
  if (!response.ok) {
    throw await apiErrorFromResponse(response);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
