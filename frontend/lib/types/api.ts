export type UserRole = "admin" | "manager" | "employee";
export interface User { id: string; company_id: string; department_id: string | null; role: UserRole; first_name: string; last_name: string; email: string; active: boolean; email_verified: boolean; last_login: string | null; created_at: string; updated_at: string; }
export interface Company { id: string; name: string; slug: string; active: boolean; created_at: string; updated_at: string; }
export interface Tokens { access_token: string; refresh_token: string; token_type: "bearer"; access_token_expires_in: number; }
export interface RegisterResponse { company: Company; user: User; tokens: Tokens; }
export interface PageMeta { offset: number; limit: number; total: number; }
export interface Page<T> { items: T[]; page: PageMeta; }
export interface Activity { id: string; company_id: string; actor_id: string | null; entity_type: string; entity_id: string; action: "created" | "updated" | "deleted"; summary: string; created_at: string; }
export interface ApiError { detail?: string | Array<{ msg: string; loc: Array<string | number> }>; }
