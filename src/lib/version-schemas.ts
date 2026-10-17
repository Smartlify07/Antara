import { z } from "zod"

/**
 * Validation for the version lane (FR-019..030): submission, submit-for-
 * review, decisions, feedback, and draft deletion. Mirrors the shape of
 * `deliverable-schemas.ts` — validators on the server functions, form
 * payloads on the client, one contract.
 */

export const versionRefSchema = z.object({
  workspaceId: z.string().min(1),
  // The project named here is the scope the access check runs against —
  // every version lives inside an asset inside a project.
  projectId: z.string().min(1),
  versionId: z.string().min(1),
})

export type VersionRefInput = z.infer<typeof versionRefSchema>

/** Fields every submission carries, regardless of how the file arrived. */
const submissionCommon = {
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  deliverableId: z.string().min(1),
  // The filename groups versions into an asset (case-insensitive, per
  // project): two submissions with the same name become two versions of
  // one file's history.
  filename: z.string().trim().min(1, "Name the file.").max(255),
  // Optional; defaults to `v{versionNo}` like every shipped version.
  label: z.string().trim().max(80).optional(),
  submitterNotes: z.string().trim().max(2000).optional(),
}

/** A link to a file that lives outside Antara. */
export const submitLinkVersionSchema = z.object({
  ...submissionCommon,
  source: z.literal("external_link"),
  url: z.string().url("Paste a full URL (including https://)."),
  // Free text until the first external integration is chosen (PRD §17);
  // the service derives a coarse label from the URL's host when unset.
  externalProvider: z.string().trim().max(40).optional(),
  // Only when the provider itself surfaces a stable file id. A URL alone
  // is never treated as file identity.
  externalFileId: z.string().trim().max(200).optional(),
})

/** A hosted upload: the browser already pushed the bytes to Cloudinary. */
export const submitUploadVersionSchema = z.object({
  ...submissionCommon,
  source: z.literal("upload"),
  url: z.string().min(1),
  provider: z.enum(["cloudinary", "aws"]),
  // The provider-side reference the deletion guard needs later.
  providerKey: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
})

export const submitVersionSchema = z.discriminatedUnion("source", [
  submitLinkVersionSchema,
  submitUploadVersionSchema,
])

export type SubmitVersionInput = z.infer<typeof submitVersionSchema>

/** Send a never-submitted version into review (FR-026). */
export const submitForReviewSchema = versionRefSchema

/** A recorded decision (FR-032..035). `changes_requested` carries no verdict. */
export const decideVersionSchema = versionRefSchema.extend({
  decision: z.enum(["approved", "rejected", "changes_requested"]),
  comment: z.string().trim().max(2000).optional(),
})

export type DecideVersionInput = z.infer<typeof decideVersionSchema>

/** Feedback on a version (FR-027) — project members only. */
export const versionFeedbackSchema = versionRefSchema.extend({
  body: z.string().trim().min(1, "Write something first.").max(4000),
})

export type VersionFeedbackInput = z.infer<typeof versionFeedbackSchema>

/** Remove a never-submitted draft; hosted bytes queue for provider deletion. */
export const deleteDraftVersionSchema = versionRefSchema
