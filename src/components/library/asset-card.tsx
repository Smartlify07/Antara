import { Link } from "@tanstack/react-router"
import type { LibraryAssetSummary } from "@/server/services/library-service"
import { formatRelativeTime } from "@/lib/time"
import { ASSET_STATE_META } from "./library-meta"

/**
 * One library row (FR-039/043): the file's name, its whole-history approval
 * state, where it lives (project + deliverable — real links, this surface is
 * where cross-thinking happens), and the FR-037 facts, muted but explicit:
 * latest version vs latest approved version, and whether the newest file is
 * a hosted upload or a link Antara cannot vouch for.
 */
export function AssetCard({
  workspaceSlug,
  asset,
}: {
  workspaceSlug: string
  asset: LibraryAssetSummary
}) {
  const stateMeta = ASSET_STATE_META[asset.approvalState]
  const latest = asset.latestVersion

  // An approval is only "current" while nothing newer was submitted after
  // it — the machine that holds review states guarantees it. When the two
  // facts diverge, the card says both.
  const latestMatchesApproved =
    Boolean(asset.latestApproved && latest) &&
    asset.latestApproved?.id === latest?.id

  return (
    <div className="rounded-xl bg-card p-4 shadow-xs ring-1 ring-border/60 transition-colors ring-inset hover:ring-border">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link
          to="/w/$workspaceSlug/library/$assetId"
          params={{ workspaceSlug, assetId: asset.id }}
          className="min-w-0 truncate text-sm font-medium tracking-tight hover:underline"
        >
          {asset.filename}
        </Link>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${stateMeta.badgeClass}`}
          title={stateMeta.hint}
        >
          {stateMeta.label}
        </span>
      </div>

      <p className="mt-1 truncate text-xs text-muted-foreground">
        <Link
          to="/w/$workspaceSlug/projects/$projectSlug"
          params={{ workspaceSlug, projectSlug: asset.projectSlug }}
          className="hover:underline"
        >
          {asset.projectTitle}
        </Link>
        {asset.deliverableTitle ? (
          <>
            <span aria-hidden> · </span>
            {asset.deliverableTitle}
          </>
        ) : null}
        {asset.assetType ? (
          <>
            <span aria-hidden> · </span>
            {asset.assetType}
          </>
        ) : null}
      </p>

      {asset.tags && asset.tags.length > 0 && (
        <p className="mt-1.5 flex flex-wrap gap-1.5">
          {asset.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </p>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        {latest ? (
          <>
            {latest.label}
            {latest.reviewStatus ? "" : " (draft)"}{" "}
            {latest.source === "external_link" ? (
              <span
                className="ml-1 rounded-md bg-muted/70 px-1.5 text-[11px] text-muted-foreground"
                title="A link to the file; Antara cannot detect changes to a linked file."
              >
                external link
              </span>
            ) : null}
            {" · submitted by "}
            {latest.submitter.name ??
              latest.submitter.email ??
              "a former member"}
            {" · "}
            {formatRelativeTime(latest.createdAt)}
          </>
        ) : (
          "No versions recorded"
        )}
        {" · "}
        {asset.versionCount === 0
          ? "not yet versioned"
          : `${asset.versionCount} ${asset.versionCount === 1 ? "version" : "versions"}`}
      </p>

      {latestMatchesApproved ? null : (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {asset.latestApproved ? (
            <>
              Latest approved{" "}
              <span className="font-medium text-emerald-700 dark:text-emerald-300">
                {asset.latestApproved.label}
              </span>
              {latest ? (
                <>
                  {" — latest version "}
                  <span className="font-medium">{latest.label}</span>
                  {" is not it"}
                </>
              ) : null}
            </>
          ) : (
            "Nothing approved yet"
          )}
        </p>
      )}
    </div>
  )
}
