import { formatDistanceToNow } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatBytes } from "@/components/projects/cloudinary-assets"
import { avatarTint } from "@/lib/avatar-tint"
import type { ProjectUpdateItem } from "@/server/services/project-update-service"

/**
 * One post in the feed — a comment or a progress update — with the files it
 * carried.
 *
 * The card carries no decisions: review and approval attach to the asset
 * VERSION each file carried (the Reviews workflow on asset_versions +
 * approvals), not to the post. Badges and controls for those decisions live
 * with the versions, where they belong to exactly one build of the file.
 */
export function UpdateCard({ update }: { update: ProjectUpdateItem }) {
  const name = update.author.name ?? update.author.email ?? "Someone"

  // An optimistic row renders identically to a real one. It is already in the
  // feed and reads as posted; a dimmed or labelled placeholder would be a
  // pending state, and there is nothing to distinguish it from the settled row
  // it becomes.
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
      <header className="flex items-center gap-2">
        <Avatar className="size-6">
          {update.author.image ? (
            <AvatarImage src={update.author.image} alt="" />
          ) : null}
          <AvatarFallback
            className={`text-[10px] ${avatarTint(update.author.id || update.id)}`}
          >
            {name.charAt(0).toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{name}</span>
            {update.kind === "progress_update" && (
              <span className="shrink-0 rounded bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                Progress update
              </span>
            )}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(update.createdAt), {
              addSuffix: true,
            })}
          </span>
        </div>
      </header>

      <p className="text-sm leading-relaxed whitespace-pre-wrap">
        {update.body}
      </p>

      {update.versions.length > 0 && (
        <ul className="flex flex-col gap-1">
          {update.versions.map((version) => (
            <li key={version.id}>
              <a
                href={version.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent"
              >
                {/* The label is the whole point of the versioning work — v1,
                    v2 — so it is rendered as a badge, not as part of the name. */}
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {version.label}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {version.filename}
                </span>
                {/* Null on an external link, whose size its provider knows
                    and we do not — nothing to show is the honest render. */}
                {version.sizeBytes !== null && (
                  <span className="shrink-0 text-muted-foreground">
                    {formatBytes(version.sizeBytes)}
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
