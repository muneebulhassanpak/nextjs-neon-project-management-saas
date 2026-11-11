import "server-only";
import { and, eq, sql } from "drizzle-orm";

import { LABEL_COLORS, type LabelColor } from "@/lib/projects";
import { labels } from "@/server/db/schema";
import { withOrgContext } from "@/server/db/tenant";

import type { BoardLabel } from "./board";
import type { Scope } from "./scope";

/**
 * Creates a label, or returns the existing one with the same name (case-insensitive), so
 * typing "bug" when "Bug" exists reuses it. New labels cycle through the colour palette.
 */
export async function createLabel(
  scope: Scope,
  input: { name: string; color?: LabelColor },
): Promise<BoardLabel> {
  return withOrgContext(scope, async (tx) => {
    const [existing] = await tx
      .select({ id: labels.id, name: labels.name, color: labels.color })
      .from(labels)
      .where(and(eq(labels.orgId, scope.orgId), sql`lower(${labels.name}) = lower(${input.name})`))
      .limit(1);
    if (existing) return existing;

    const [{ total } = { total: 0 }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(labels)
      .where(eq(labels.orgId, scope.orgId));
    const color = input.color ?? LABEL_COLORS[total % LABEL_COLORS.length] ?? "gray";
    const [label] = await tx
      .insert(labels)
      .values({ orgId: scope.orgId, name: input.name, color })
      .returning({ id: labels.id, name: labels.name, color: labels.color });
    if (!label) throw new Error("Label insert returned no row");
    return label;
  });
}
