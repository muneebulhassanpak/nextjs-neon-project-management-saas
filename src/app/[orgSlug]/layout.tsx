import { Suspense } from "react";

import { AppSidebar } from "@/components/app/app-sidebar";
import { NotificationBell } from "@/components/app/notification-bell";
import { QueryProvider } from "@/components/app/query-provider";
import { SidebarFallback } from "@/components/app/sidebar-fallback";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { requireOrg } from "@/server/auth/org";
import { listMemberships } from "@/server/services/organizations";

export default function OrgLayout({ children, params }: LayoutProps<"/[orgSlug]">) {
  return (
    <QueryProvider>
      <SidebarProvider>
        {/* The session is read inside a boundary, so the page shell renders without waiting. */}
        <Suspense fallback={<SidebarFallback />}>
          <OrgSidebar params={params} />
        </Suspense>
        <SidebarInset className="min-w-0">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <div className="ml-auto">
              <Suspense fallback={null}>
                <HeaderBell params={params} />
              </Suspense>
            </div>
          </header>
          {/* Pages marked data-wide (the board) use the full width. */}
          <div className="mx-auto w-full max-w-5xl flex-1 p-6 has-data-wide:max-w-none">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </QueryProvider>
  );
}

async function OrgSidebar({ params }: Pick<LayoutProps<"/[orgSlug]">, "params">) {
  const { orgSlug } = await params;
  const { user, org, role } = await requireOrg(orgSlug);
  const memberships = await listMemberships(user.id);

  return (
    <AppSidebar
      current={{ ...org, role }}
      orgs={memberships.map((m) => ({ ...m.org, role: m.role }))}
      user={{ name: user.name, email: user.email, image: user.image }}
    />
  );
}

async function HeaderBell({ params }: Pick<LayoutProps<"/[orgSlug]">, "params">) {
  const { org } = await requireOrg((await params).orgSlug);
  return <NotificationBell orgId={org.id} orgSlug={org.slug} />;
}
