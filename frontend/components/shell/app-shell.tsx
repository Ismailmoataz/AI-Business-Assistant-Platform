"use client";

import { usePathname } from "next/navigation";
import { DesktopSidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { Breadcrumbs } from "./breadcrumbs";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const collapsed = useUIStore((state) => state.sidebarCollapsed);
  const workspace = usePathname() === "/assistant";
  return (
    <div className="min-h-screen">
      <DesktopSidebar />
      <div className={cn("min-h-screen transition-[padding] duration-200", collapsed ? "lg:pl-[72px]" : "lg:pl-[248px]")}>
        <Topbar />
        <main className={cn(workspace ? "h-[calc(100dvh-4rem)] overflow-hidden" : "mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8")}>
          {!workspace && <Breadcrumbs />}
          {children}
        </main>
      </div>
    </div>
  );
}
