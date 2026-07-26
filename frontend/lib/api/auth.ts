import { api } from "./client";
import type { RegisterResponse, Tokens, User } from "@/lib/types/api";
export interface RegisterPayload { company_name: string; company_slug: string; first_name: string; last_name: string; email: string; password: string; }
export const authApi = {
  login: (email: string, password: string) => api<Tokens>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  register: (payload: RegisterPayload) => api<RegisterResponse>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  forgot: (email: string) => api<{ message: string }>("/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email }) }),
  reset: (token: string, password: string) => api<{ message: string }>("/auth/password-reset/confirm", { method: "POST", body: JSON.stringify({ token, password }) }),
  googleUrl: () => api<{ authorization_url: string }>("/auth/google/authorize-url"), me: () => api<User>("/users/me"),
};
