"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Company, Tokens, User } from "@/lib/types/api";
interface AuthState { tokens: Tokens | null; user: User | null; company: Company | null; hasHydrated: boolean; setSession: (tokens: Tokens, user?: User, company?: Company) => void; setUser: (user: User) => void; setCompany: (company: Company) => void; setHasHydrated: (hydrated: boolean) => void; clear: () => void; }
export const useAuthStore = create<AuthState>()(persist((set) => ({
  tokens: null, user: null, company: null, hasHydrated: false,
  setSession: (tokens, user, company) => set((state) => ({ tokens, user: user ?? state.user, company: company ?? state.company })),
  setUser: (user) => set({ user }), setCompany: (company) => set({ company }), setHasHydrated: (hasHydrated) => set({ hasHydrated }), clear: () => set({ tokens: null, user: null, company: null }),
}), { name: "ba-session", onRehydrateStorage: () => (state) => state?.setHasHydrated(true) }));
