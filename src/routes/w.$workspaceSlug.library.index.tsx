import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { AlertCircleIcon, ImagesIcon } from "lucide-react"
import {
  AssetBook,
  LibraryFolderWall,
  folderMetaLine,
} from "@/components/library/library-folders"
import {
  groupAssetsIntoFolders,
} from "@/components/library/folder-grouping"
import { LibraryFilters } from "@/components/library/library-filters"
import type { LibraryFilterPatch } from "@/components/library/library-filters"
import { ProjectCoverArt } from "@/components/workspace/project-cover-art"
import { libraryQuery } from "@/lib/queries/library"
import { projectDeliverablesQuery } from "@/lib/queries/deliverables"
import { projectsQuery } from "@/lib/queries/projects"
import type { LibrarySearchParams } from "@/lib/library-schemas"

export const Route = createFileRoute("/w/$workspaceSlug/library/")({
  component: LibraryPage,
})

/**
 * The Library (FR-039..044) — the workspace's whole file inventory, held as
 * folder cutouts that stand for projects: an unfiltered library is the
 * folder wall, and every named filter — a project, a search, a state —
 * reads the matching files as standing book covers whose record sheets open
 * in place. Every filter word lives in the URL (the layout validates it),
 * so a filtered view survives a refresh and can be linked from a deliverable
 * card or anywhere else; a cutout's link is that same contract (`?project=…`).
 *
 * react-query rather than a route loader, like every other list in the app:
 * the fetch rides the filters key, so the wire trip carries exactly what the
 * visible state needs. The list payload carries each asset's whole version
 * timeline (see `library-service`), so an opened book costs no second fetch.
 */
function LibraryPage() {
  const { workspaceId, workspace } = Route.useRouteContext()
  const workspaceSlug = workspace.slug
  const filters = Route.useSearch()
  const navigate = Route.useNavigate()

  const { data, isPending, error } = useQuery(
    libraryQuery(workspaceId, {
      q: filters.q,
      assetType: filters.type,
      projectId: filters.project,
      deliverableId:
        filters.project && filters.deliverable
          ? filters.deliverable
          : undefined,
      approvalState: filters.state,
    })
  )

  // The project facet (and the deliverables inside the picked one) ride
  // their existing queries — the same data the wall and the Work tab cache
  // already hold, composed rather than duplicated.
  const {
    data: projectsData,
    isPending: projectsPending,
  } = useQuery(projectsQuery(workspaceId))
  const projects = projectsData ?? []
  const { data: deliverableData } = useQuery({
    ...projectDeliverablesQuery(workspaceId, filters.project ?? ""),
    enabled: Boolean(filters.project),
  })
  const deliverables = (deliverableData?.deliverables ?? []).map(
    (deliverable) => ({ id: deliverable.id, title: deliverable.title })
  )

  // Typing writes the URL only after a pause, so a "keynotes" search is one
  // navigation, not eight. replace: true keeps the filter row out of the
  // back stack — one browser-back step returns to the pre-filter page.
  const searchTimer = useRef<number | null>(null)
  function scheduleSearch(term: string) {
    if (searchTimer.current !== null) {
      window.clearTimeout(searchTimer.current)
    }
    searchTimer.current = window.setTimeout(() => {
      void navigate({
        search: (prev) => ({ ...prev, q: term.trim() || undefined }),
        replace: true,
      })
    }, 350)
  }

  function patchFilters(patch: LibraryFilterPatch) {
    void navigate({
      search: (prev) => {
        const next: LibrarySearchParams = { ...prev, ...patch }
        // A deliverable belongs to its project; naming a new project
        // invalidates the old pair's meaning.
        if (patch.project !== undefined) next.deliverable = undefined
        if (
          patch.deliverable !== undefined &&
          !patch.project &&
          !prev.project
        ) {
          next.deliverable = undefined
        }
        return next
      },
      replace: true,
    })
  }

  const assets = data?.assets ?? []
  const facets = data?.facets ?? { assetTypes: [] }
  // A hand-typed link may carry a deliverable without its project — assets
  // scope through the project, so that pair names nothing honest. The page
  // refuses to widen the answer: no project, no deliverable-filtered rows.
  const hasFilter =
    Boolean(filters.q) ||
    Boolean(filters.type) ||
    Boolean(filters.project) ||
    Boolean(filters.deliverable) ||
    Boolean(filters.state)
  const unscopableDeliverable = Boolean(filters.deliverable) && !filters.project
  const wallMode = !hasFilter

  // The wall's folders: the assets folded into the projects they live in —
  // a folder is a project, titled by its name, whether or not files have
  // arrived yet. A project scope (and nothing else) is that folder's own
  // shelf, so its header answers "where am I" with the folder's identity.
  const folders = useMemo(
    () => groupAssetsIntoFolders(assets, projects),
    [assets, projects]
  )
  const scopedFolder = useMemo(
    () =>
      filters.project
        ? (folders.find((folder) => folder.id === filters.project) ?? null)
        : null,
    [folders, filters.project]
  )
  const projectOnly =
    Boolean(filters.project) &&
    !filters.q &&
    !filters.type &&
    !filters.deliverable &&
    !filters.state

  // One book open at a time; Escape closes it, whichever cell holds focus.
  const [expandedId, setExpandedId] = useState<string | null>(null)
  useEffect(() => {
    if (!expandedId) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpandedId(null)
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [expandedId])

  const loading = isPending || (wallMode && projectsPending)
  const showEmpty =
    !loading &&
    !error &&
    (wallMode
      ? folders.length === 0
      : assets.length === 0 || unscopableDeliverable)
  // A scoped folder with no files is an empty folder, not a failed filter.
  const projectScopedEmpty = projectOnly && assets.length === 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        {hasFilter && (
          <Link
            to="/w/$workspaceSlug/library"
            params={{ workspaceSlug }}
            className="w-fit rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {"← All folders"}
          </Link>
        )}
        {projectOnly && scopedFolder ? (
          <div className="flex items-center gap-3">
            <ProjectCoverArt
              seed={scopedFolder.slug}
              gradient={{
                start: scopedFolder.gradientStart,
                end: scopedFolder.gradientEnd,
              }}
              className="h-7 w-11 shrink-0 rounded-lg"
            />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-medium tracking-tighter">
                {scopedFolder.title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {folderMetaLine(scopedFolder)}
              </p>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-medium tracking-tighter">Library</h1>
            <p className="text-sm tracking-tight text-muted-foreground">
              Every file this workspace can account for, with its version history
              and what was approved of it.
            </p>
          </div>
        )}
      </div>

      <LibraryFilters
        filters={filters}
        facets={facets}
        projects={projects}
        deliverables={deliverables}
        onSearch={scheduleSearch}
        onPatch={patchFilters}
      />

      {loading && (
        <p className="text-sm text-muted-foreground">Loading the library…</p>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircleIcon className="size-4 shrink-0" />
          {error instanceof Error
            ? error.message
            : "Could not load the library."}
        </div>
      )}

      {showEmpty && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
            <ImagesIcon className="size-6 text-muted-foreground" />
          </div>
          <div className="flex max-w-md flex-col gap-2">
            <h2 className="text-xl font-medium tracking-tighter">
              {!hasFilter || projectScopedEmpty
                ? "No files yet"
                : "Nothing matches these filters"}
            </h2>
            <p className="text-sm tracking-tight text-balance text-muted-foreground">
              {projectScopedEmpty
                ? "Files arrive through project deliverables and feed posts. Submit the first version of a file and it will appear in this folder."
                : hasFilter
                  ? "Loosen a filter or clear them all — the library only shows what its filters allow."
                  : "Files arrive through project deliverables and feed posts. Submit the first version of a file and it will appear here."}
            </p>
          </div>
        </div>
      )}

      {wallMode && folders.length > 0 && (
        <LibraryFolderWall
          workspaceSlug={workspaceSlug}
          folders={folders}
        />
      )}

      {!wallMode && assets.length > 0 && !unscopableDeliverable && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <AssetBook
              key={asset.id}
              workspaceSlug={workspaceSlug}
              asset={asset}
              showProject={!filters.project}
              expanded={expandedId === asset.id}
              onToggle={() =>
                setExpandedId((current) =>
                  current === asset.id ? null : asset.id
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
