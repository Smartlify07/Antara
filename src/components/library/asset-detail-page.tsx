import { Link } from "@tanstack/react-router"
import {
  ArrowLeftIcon,
  CircleCheckIcon,
  CircleXIcon,
  LinkIcon,
} from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { AppLoading } from "@/components/app-loading"
import { Button } from "@/components/ui/button"
import { REVIEW_STATUS_META } from "@/components/projects/details/deliverables/version-meta"
import type {
  LibraryApprovalRecord,
  LibraryPerson,
  LibraryVersionDetail,
} from "@/server/services/library-service"
import { libraryAssetQuery } from "@/lib/queries/library"
import { formatRelativeTime } from "@/lib/time"
import { formatBytes } from "@/components/projects/cloudinary-assets"
import { ASSET_STATE_META } from "./library-meta"

/**
 * One asset's deep-linked detail (FR-040/042/043/044): its links to the work
 * (project and deliverable), and its full version timeline — uploader and
 * timestamp per version, the submitter's note, the source with the version
 * lane's honest link copy, and the append-only approval history in full.
 * Read-only by design: this page is where questions are answered, not where
 * the workflow happens.
 */
export function AssetDetailPage({
  workspaceSlug,
  workspaceId,
  assetId,
}: {
  workspaceSlug: string
  workspaceId: string
  assetId: string
}) {
  const {
    data: asset = null,
    isPending,
    error,
  } = useQuery(libraryAssetQuery(workspaceId, assetId))

  // The whole record — links, version timeline, decisions — is one page, so
  // it renders on arrival; the shell's pulsing logo covers the fetch.
  if (isPending) return <AppLoading />

  if (error) {
    return (
      <div
        role="alert"
        className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
      >
        {error instanceof Error ? error.message : "Could not load this asset."}
      </div>
    )
  }

  if (!asset) {
    return (
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        This asset does not exist in this workspace — it may have been removed
        along with its project.
      </div>
    )
  }

  const stateMeta = ASSET_STATE_META[asset.approvalState]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button
          asChild
          size="sm"
          variant="ghost"
          className="-ml-2 text-muted-foreground"
        >
          <Link to="/w/$workspaceSlug/library" params={{ workspaceSlug }}>
            <ArrowLeftIcon />
            All files
          </Link>
        </Button>
      </div>

      <header className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${stateMeta.badgeClass}`}
            title={stateMeta.hint}
          >
            {stateMeta.label}
          </span>
          <span className="text-xs text-muted-foreground">
            first added {formatRelativeTime(asset.createdAt)}
          </span>
          <span className="text-xs text-muted-foreground">
            · last touched {formatRelativeTime(asset.updatedAt)}
          </span>
        </div>

        <h1 className="mt-2 text-2xl font-medium tracking-tighter break-words">
          {asset.filename}
        </h1>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <Link
            to="/w/$workspaceSlug/projects/$projectSlug"
            params={{ workspaceSlug, projectSlug: asset.project.slug }}
            className="rounded-md bg-secondary px-1.5 py-0.5 hover:underline"
          >
            {asset.project.title}
          </Link>
          {asset.deliverable && <span>{asset.deliverable.title}</span>}
          {asset.assetType && (
            <span>
              Type: <span className="text-foreground">{asset.assetType}</span>
            </span>
          )}
          {asset.tags && asset.tags.length > 0 && (
            <span className="flex flex-wrap gap-1.5">
              {asset.tags.map((tag) => (
                <span key={tag} className="rounded-md bg-muted px-1.5 py-0.5">
                  {tag}
                </span>
              ))}
            </span>
          )}
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold text-muted-foreground">
          Version history —{" "}
          {asset.versions.length === 0
            ? "none recorded"
            : `${asset.versions.length} recorded`}
        </h2>

        {asset.versions.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No version was recorded for this file. Newer submissions of the same
            filename will grow its history here.
          </p>
        ) : (
          <ol className="rounded-xl border bg-card p-4 pb-1">
            {asset.versions.map((version) => (
              <VersionRow key={version.id} version={version} />
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

function VersionRow({ version }: { version: LibraryVersionDetail }) {
  const statusChip = version.reviewStatus
    ? REVIEW_STATUS_META[version.reviewStatus]
    : { label: "Draft", badgeClass: "bg-muted text-muted-foreground" }

  return (
    <li className="border-t py-2.5 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">
          {version.label}
        </span>
        {version.isLatest && (
          <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground">
            Latest
          </span>
        )}
        {version.isLatestApproved && (
          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            Latest approved
          </span>
        )}
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusChip.badgeClass}`}
        >
          {statusChip.label}
        </span>
        <span className="ml-auto truncate text-xs text-muted-foreground">
          {displayName(version.submitter)} ·{" "}
          {formatRelativeTime(version.createdAt)}
        </span>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        {version.source === "external_link" ? (
          <>
            <LinkIcon aria-hidden className="mr-1 inline size-3" />
            External link
            {version.externalProvider
              ? " (" + version.externalProvider + ")"
              : ""}{" "}
            —{" "}
            <a
              href={version.url}
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-2 hover:text-foreground"
            >
              open file
            </a>
            . Antara cannot detect changes to a linked file.
          </>
        ) : (
          <>
            {version.mimeType ?? "file"}
            {version.sizeBytes !== null
              ? " · " + formatBytes(version.sizeBytes)
              : ""}{" "}
            — hosted upload
          </>
        )}
      </p>

      {version.submittedAt && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          Sent for review {formatRelativeTime(version.submittedAt)}
        </p>
      )}

      {version.submitterNotes && (
        <p className="mt-1.5 text-sm break-words">“{version.submitterNotes}”</p>
      )}

      {version.decisions.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-1">
          {version.decisions.map((decision, index) => (
            <DecisionLine key={index} decision={decision} />
          ))}
        </ul>
      )}
    </li>
  )
}

function DecisionLine({ decision }: { decision: LibraryApprovalRecord }) {
  return (
    <li className="flex items-start gap-1.5 text-xs text-muted-foreground">
      {decision.decision === "approved" ? (
        <CircleCheckIcon className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <CircleXIcon className="mt-0.5 size-3.5 shrink-0 text-destructive/70" />
      )}
      <span>
        <span className="font-medium text-foreground">
          {decision.decision === "approved" ? "Approved" : "Rejected"}
        </span>
        {" by "}
        {displayName(decision.approver)}
        {" · "}
        {formatRelativeTime(decision.decidedAt)}
        {decision.comment && (
          <span className="break-words"> — “{decision.comment}”</span>
        )}
      </span>
    </li>
  )
}

/** The actor convention: a named person, an addressable email, or a past. */
function displayName(person: LibraryPerson): string {
  return person.name ?? person.email ?? "a former member"
}
