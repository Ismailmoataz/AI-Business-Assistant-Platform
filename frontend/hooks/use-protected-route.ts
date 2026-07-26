"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";

export function useProtectedRoute() {
  const router = useRouter();
  const tokens = useAuthStore((state) => state.tokens);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  useEffect(() => { if (hasHydrated && !tokens) router.replace("/login"); }, [hasHydrated, router, tokens]);
  return { ready: hasHydrated && Boolean(tokens), user: useAuthStore((state) => state.user) };
}
