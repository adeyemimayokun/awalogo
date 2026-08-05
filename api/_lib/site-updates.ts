import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Date must be a valid calendar date");
const idSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const actionHrefSchema = z.string().trim().min(1).max(500).refine((value) => {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, "Action link must be a site path or HTTPS URL");

export const siteUpdateSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(2).max(100),
  summary: z.string().trim().min(2).max(280),
  published_at: dateSchema,
  action_label: z.string().trim().min(2).max(50),
  action_href: actionHrefSchema,
  status: z.enum(["draft", "published"]),
  created_at: dateSchema,
  updated_at: dateSchema
});

export const siteUpdatesSchema = z.array(siteUpdateSchema);

const editableFields = {
  title: z.string().trim().min(2).max(100),
  summary: z.string().trim().min(2).max(280),
  publishedAt: dateSchema,
  actionLabel: z.string().trim().min(2).max(50),
  actionHref: actionHrefSchema,
  status: z.enum(["draft", "published"])
};

export const siteUpdateMutationSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("create"), id: idSchema, ...editableFields }),
  z.object({ operation: z.literal("update"), id: idSchema, ...editableFields }),
  z.object({ operation: z.literal("delete"), id: idSchema, confirmation: z.string() })
]);

export type SiteUpdate = z.infer<typeof siteUpdateSchema>;
export type SiteUpdateMutation = z.infer<typeof siteUpdateMutationSchema>;

export function applySiteUpdateMutation(
  input: unknown,
  mutationInput: unknown,
  today = new Date().toISOString().slice(0, 10)
): SiteUpdate[] {
  const updates = siteUpdatesSchema.parse(input).map((item) => ({ ...item }));
  const mutation = siteUpdateMutationSchema.parse(mutationInput);
  const index = updates.findIndex((item) => item.id === mutation.id);

  if (mutation.operation === "delete") {
    if (mutation.confirmation !== mutation.id) throw new Error("Confirmation does not match the update ID");
    if (index < 0) throw new Error(`Update "${mutation.id}" was not found`);
    updates.splice(index, 1);
  } else {
    if (mutation.operation === "create" && index >= 0) throw new Error(`Update "${mutation.id}" already exists`);
    if (mutation.operation === "update" && index < 0) throw new Error(`Update "${mutation.id}" was not found`);
    const current = index >= 0 ? updates[index] : null;
    const next = siteUpdateSchema.parse({
      id: mutation.id,
      title: mutation.title,
      summary: mutation.summary,
      published_at: mutation.publishedAt,
      action_label: mutation.actionLabel,
      action_href: mutation.actionHref,
      status: mutation.status,
      created_at: current?.created_at ?? today,
      updated_at: today
    });
    if (index >= 0) updates[index] = next;
    else updates.push(next);
  }

  return updates.sort((left, right) =>
    right.published_at.localeCompare(left.published_at) || right.updated_at.localeCompare(left.updated_at) || left.id.localeCompare(right.id)
  );
}
