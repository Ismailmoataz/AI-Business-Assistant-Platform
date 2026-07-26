"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DashboardWidgetId = "my-work" | "projects" | "documents" | "ai" | "customers" | "employees" | "activity";
export type DashboardLayout = "balanced" | "compact";

export const defaultDashboardOrder: DashboardWidgetId[] = ["my-work", "projects", "documents", "ai", "customers", "employees", "activity"];

interface UIState {
  sidebarCollapsed: boolean;
  mobileOpen: boolean;
  dashboardLayout: DashboardLayout;
  dashboardWidgetOrder: DashboardWidgetId[];
  dashboardCollapsed: Partial<Record<DashboardWidgetId, boolean>>;
  toggleSidebar: () => void;
  setMobileOpen: (open: boolean) => void;
  setDashboardLayout: (layout: DashboardLayout) => void;
  moveDashboardWidget: (id: DashboardWidgetId, direction: -1 | 1) => void;
  toggleDashboardWidget: (id: DashboardWidgetId) => void;
  resetDashboard: () => void;
}
export const useUIStore = create<UIState>()(persist((set) => ({
  sidebarCollapsed: false,
  mobileOpen: false,
  dashboardLayout: "balanced",
  dashboardWidgetOrder: defaultDashboardOrder,
  dashboardCollapsed: {},
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setMobileOpen: (mobileOpen) => set({ mobileOpen }),
  setDashboardLayout: (dashboardLayout) => set({ dashboardLayout }),
  moveDashboardWidget: (id, direction) => set((state) => {
    const order = [...state.dashboardWidgetOrder];
    const index = order.indexOf(id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= order.length) return state;
    [order[index], order[next]] = [order[next], order[index]];
    return { dashboardWidgetOrder: order };
  }),
  toggleDashboardWidget: (id) => set((state) => ({ dashboardCollapsed: { ...state.dashboardCollapsed, [id]: !state.dashboardCollapsed[id] } })),
  resetDashboard: () => set({ dashboardLayout: "balanced", dashboardWidgetOrder: defaultDashboardOrder, dashboardCollapsed: {} }),
}), {
  name: "ba-ui",
  partialize: (state) => ({
    sidebarCollapsed: state.sidebarCollapsed,
    dashboardLayout: state.dashboardLayout,
    dashboardWidgetOrder: state.dashboardWidgetOrder,
    dashboardCollapsed: state.dashboardCollapsed,
  }),
}));
