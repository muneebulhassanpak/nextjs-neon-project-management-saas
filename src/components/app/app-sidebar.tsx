"use client";

import { FolderKanban, LayoutDashboard, ListTodo, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

import { OrgSwitcher, type OrgSummary } from "./org-switcher";
import { UserMenu, type UserSummary } from "./user-menu";

export function AppSidebar({
  current,
  orgs,
  user,
}: {
  current: OrgSummary;
  orgs: OrgSummary[];
  user: UserSummary;
}) {
  const pathname = usePathname();
  const base = `/${current.slug}`;
  const canManage = current.role === "owner" || current.role === "admin";

  const nav = [
    { href: base, label: "Overview", icon: LayoutDashboard, exact: true },
    // Clients aren't assigned tasks.
    ...(current.role === "client"
      ? []
      : [{ href: `${base}/my-work`, label: "My work", icon: ListTodo, exact: true }]),
    { href: `${base}/projects`, label: "Projects", icon: FolderKanban, exact: false },
    { href: `${base}/settings/members`, label: "Members", icon: Users, exact: false },
    ...(canManage
      ? [{ href: `${base}/settings`, label: "Settings", icon: Settings, exact: true }]
      : []),
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <OrgSwitcher current={current} orgs={orgs} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => {
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link href={item.href} aria-current={active ? "page" : undefined}>
                        <item.icon aria-hidden />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <UserMenu user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
