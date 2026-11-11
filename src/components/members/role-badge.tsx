import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, type Role } from "@/lib/roles";

export function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge variant={role === "owner" ? "default" : "secondary"} className="font-normal">
      {ROLE_LABELS[role]}
    </Badge>
  );
}
