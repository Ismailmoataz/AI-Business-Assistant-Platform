"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
import { Bell, Check, ChevronDown, LogOut, Menu, Moon, Settings, Sun, UserRound, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { GlobalSearch } from "@/components/search/global-search";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useUIStore } from "@/stores/ui-store";
import { SidebarContent } from "./sidebar";

export function Topbar() {
  const { theme, setTheme } = useTheme(); const router = useRouter(); const { user, clear } = useAuthStore(); const { mobileOpen, setMobileOpen } = useUIStore(); const name = user ? `${user.first_name} ${user.last_name}` : "Account"; const accountInitials = user ? initials(user.first_name, user.last_name) : "A";
  return <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}><header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-xl sm:px-6"><Dialog.Trigger asChild><Button className="lg:hidden" variant="ghost" size="icon" aria-label="Open navigation"><Menu className="size-5" /></Button></Dialog.Trigger><GlobalSearch /><div className="ml-auto flex items-center gap-1"><Button variant="ghost" size="icon" aria-label={theme === "dark" ? "Use light mode" : "Use dark mode"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}</Button><Button variant="ghost" size="icon" aria-label="Notifications" className="relative"><Bell className="size-[18px]" /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" /></Button><Dropdown.Root><Dropdown.Trigger asChild><Button variant="ghost" className="ml-1 h-10 gap-2 px-1.5"><Avatar className="size-8"><AvatarFallback>{accountInitials}</AvatarFallback></Avatar><span className="hidden max-w-28 truncate text-sm md:block">{name}</span><ChevronDown className="hidden size-3 text-muted-foreground md:block" /></Button></Dropdown.Trigger><Dropdown.Portal><Dropdown.Content sideOffset={8} align="end" className="z-50 w-56 rounded-xl border bg-card p-1.5 shadow-xl"><div className="px-2 py-2"><p className="text-sm font-medium">{name}</p><p className="truncate text-xs text-muted-foreground">{user?.email ?? "Signed-in workspace"}</p></div><Dropdown.Separator className="my-1 h-px bg-border" /><Item icon={UserRound}>Profile</Item><Item icon={Settings}>Settings</Item><Dropdown.Separator className="my-1 h-px bg-border" /><Item icon={LogOut} onSelect={() => { clear(); router.push("/login"); }}>Sign out</Item></Dropdown.Content></Dropdown.Portal></Dropdown.Root></div></header><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm lg:hidden" /><Dialog.Content className="fixed inset-y-0 left-0 z-50 w-[min(88vw,320px)] bg-background shadow-2xl outline-none lg:hidden"><Dialog.Title className="sr-only">Workspace navigation</Dialog.Title><Dialog.Description className="sr-only">Navigate between Orbit workspaces.</Dialog.Description><Dialog.Close asChild><Button variant="ghost" size="icon" className="absolute right-3 top-3 z-10" aria-label="Close navigation"><X className="size-5" /></Button></Dialog.Close><SidebarContent mobile /></Dialog.Content></Dialog.Portal></Dialog.Root>;
}

function Item({ icon: Icon, children, onSelect }: { icon: typeof Check; children: React.ReactNode; onSelect?: () => void }) { return <Dropdown.Item onSelect={onSelect} className="flex cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none focus:bg-muted"><Icon className="size-4 text-muted-foreground" />{children}</Dropdown.Item>; }
