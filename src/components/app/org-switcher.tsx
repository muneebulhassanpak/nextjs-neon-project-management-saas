"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { initials } from "@/lib/initials";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { switchOrganization } from "@/server/actions/organizations";

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  role: Role;
}

function OrgAvatar({ org }: { org: Pick<OrgSummary, "name" | "logo"> }) {
  return (
    <Avatar className="size-8 rounded-md">
      {org.logo && <AvatarImage src={org.logo} alt="" />}
      <AvatarFallback className="rounded-md bg-primary text-xs font-semibold text-primary-foreground">
        {initials(org.name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function OrgSwitcher({ current, orgs }: { current: OrgSummary; orgs: OrgSummary[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" disabled={pending} aria-label="Switch organization">
              <OrgAvatar org={current} />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{current.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {ROLE_LABELS[current.role]}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" aria-hidden />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64" align="start">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Organizations
            </DropdownMenuLabel>
            {orgs.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onSelect={() => {
                  if (org.id !== current.id) {
                    startTransition(() => switchOrganization(org.id, org.slug));
                  }
                }}
              >
                <OrgAvatar org={org} />
                <span className="truncate">{org.name}</span>
                {org.id === current.id && <Check className="ml-auto size-4" aria-label="Current" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/onboarding">
                <Plus className="size-4" aria-hidden />
                Create organization
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
