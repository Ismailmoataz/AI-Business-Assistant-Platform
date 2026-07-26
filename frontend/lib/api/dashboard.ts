import { api } from "@/lib/api/client";
import type { DashboardOverview } from "@/lib/types/dashboard";

export const dashboardKeys = {
  overview: ["dashboard", "overview"] as const,
};

export function getDashboardOverview() {
  return api<DashboardOverview>("/dashboard/overview");
}
