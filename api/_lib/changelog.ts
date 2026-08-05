import { z } from "zod";

const versionSchema = z.string().regex(/^v[1-9]\d*\.0\.0$/, "Version must be a major release such as v2.0.0");
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Date must be a valid calendar date");
const releaseNotesSchema = z.array(z.string().trim().min(2).max(300)).min(1).max(30);

export const changelogReleaseSchema = z.object({
  version: versionSchema,
  title: z.string().trim().min(2).max(100),
  date: dateSchema,
  changes: releaseNotesSchema,
  status: z.enum(["draft", "published"]),
  created_at: dateSchema,
  updated_at: dateSchema
});

export const changelogSchema = z.array(changelogReleaseSchema).superRefine((releases, context) => {
  const versions = new Set<string>();
  releases.forEach((release, index) => {
    if (versions.has(release.version)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate changelog version: ${release.version}`, path: [index, "version"] });
    }
    versions.add(release.version);
  });
});

const editableFields = {
  title: z.string().trim().min(2).max(100),
  date: dateSchema,
  changes: releaseNotesSchema,
  status: z.enum(["draft", "published"])
};

export const changelogMutationSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("create"), version: versionSchema, ...editableFields }),
  z.object({ operation: z.literal("update"), version: versionSchema, ...editableFields }),
  z.object({ operation: z.literal("delete"), version: versionSchema, confirmation: z.string() })
]);

export type ChangelogRelease = z.infer<typeof changelogReleaseSchema>;

function releaseNumber(version: string): number {
  return Number(version.slice(1).split(".")[0]);
}

export function applyChangelogMutation(
  input: unknown,
  mutationInput: unknown,
  today = new Date().toISOString().slice(0, 10)
): ChangelogRelease[] {
  const releases = changelogSchema.parse(input).map((release) => ({ ...release, changes: [...release.changes] }));
  const mutation = changelogMutationSchema.parse(mutationInput);
  const index = releases.findIndex((release) => release.version === mutation.version);

  if (mutation.operation === "delete") {
    if (mutation.confirmation !== mutation.version) throw new Error("Confirmation does not match the release version");
    if (index < 0) throw new Error(`Release "${mutation.version}" was not found`);
    releases.splice(index, 1);
  } else {
    if (mutation.operation === "create" && index >= 0) throw new Error(`Release "${mutation.version}" already exists`);
    if (mutation.operation === "update" && index < 0) throw new Error(`Release "${mutation.version}" was not found`);
    const current = index >= 0 ? releases[index] : null;
    const next = changelogReleaseSchema.parse({
      version: mutation.version,
      title: mutation.title,
      date: mutation.date,
      changes: mutation.changes,
      status: mutation.status,
      created_at: current?.created_at ?? today,
      updated_at: today
    });
    if (index >= 0) releases[index] = next;
    else releases.push(next);
  }

  return releases.sort((left, right) =>
    right.date.localeCompare(left.date) || releaseNumber(right.version) - releaseNumber(left.version)
  );
}
