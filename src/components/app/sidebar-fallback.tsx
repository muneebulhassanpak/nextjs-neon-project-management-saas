import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";

/** Shown while the sidebar's session and organization data load. */
export function SidebarFallback() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenuSkeleton showIcon />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu className="p-2">
          {[1, 2, 3].map((i) => (
            <SidebarMenuItem key={i}>
              <SidebarMenuSkeleton showIcon />
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
