import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useRef } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { AlertCircleIcon, ImagesIcon } from "lucide-react"
import { AppLoading } from "@/components/app-loading"
import { AssetCard } from "@/components/library/asset-card"
import { LibraryFilters } from "@/components/library/library-filters"
import type { LibraryFilterPatch } from "@/components/library/library-filters"
import { libraryQuery } from "@/lib/queries/library"
import { projectDeliverablesQuery } from "@/lib/queries/deliverables"
import { projectsQuery } from "@/lib/queries/projects"
import type { LibrarySearchParams } from "@/lib/library-schemas"

export const Route = createFileRoute("/w/$workspaceSlug/library/")({
  component: LibraryPage,
})

/**
 * The Library (FR-039..044) — the workspace's whole file inventory,
 * searchable and filterable. Every filter word lives in the URL (the layout
 * validates it), so a filtered view survives a refresh and can be linked
 * from a deliverable card or anywhere else.
 *
 * react-query rather than a route loader, like every other list in the app:
 * the fetch rides the filters key, so the wire trip carries exactly what the
 * visible state needs.
 */
function LibraryPage() {
  const { workspaceId, workspace } = Route.useRouteContext()
  const workspaceSlug = workspace.slug
  const filters = Route.useSearch()
  const navigate = Route.useNavigate()

  // Filter words ride the query key, so every filter change is a new fetch.
  // keepPreviousData holds the last list on screen while it runs — the page
  // logo is for arriving at the page, not for each keystroke on the search.
  const { data, isPending, error } = useQuery({
    ...libraryQuery(workspaceId, {
      q: filters.q,
      assetType: filters.type,
      projectId: filters.project,
      deliverableId:
        filters.project && filters.deliverable
          ? filters.deliverable
          : undefined,
      approvalState: filters.state,
    }),
    placeholderData: keepPreviousData,
  })

  // The project facet (and the deliverables inside the picked one) ride
  // their existing queries — the same data the grid and the Work tab cache
  // already hold, composed rather than duplicated.
  const { data: projects = [], isPending: projectsPending } = useQuery(
    projectsQuery(workspaceId)
  )
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
  const showEmpty =
    !isPending && !error && (assets.length === 0 || unscopableDeliverable)

  // One arrival: the header, the filters, and the grid all read the list, so
  // the page paints once, complete — the shell's pulsing logo covers the
  // fetch. The deliverable facet stays out of the gate: it is a pick-list
  // that only drives search, and gating on it would flash the whole page on
  // every project the viewer switches to.
  if (isPending || projectsPending) return <AppLoading />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tighter">Library</h1>
          <p className="text-sm tracking-tight text-muted-foreground">
            Every file this workspace can account for, with its version history
            and what was approved of it.
          </p>
        </div>
      </div>

      <LibraryFilters
        filters={filters}
        facets={facets}
        projects={projects}
        deliverables={deliverables}
        onSearch={scheduleSearch}
        onPatch={patchFilters}
      />

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
              {hasFilter ? "Nothing matches these filters" : "No files yet"}
            </h2>
            <p className="text-sm tracking-tight text-balance text-muted-foreground">
              {hasFilter
                ? "Loosen a filter or clear them all — the library only shows what its filters allow."
                : "Files arrive through project deliverables and feed posts. Submit the first version of a file and it will appear here."}
            </p>
          </div>
        </div>
      )}

      {assets.length > 0 && !unscopableDeliverable && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => (
            <AssetCard
              key={asset.id}
              workspaceSlug={workspaceSlug}
              asset={asset}
            />
          ))}
        </div>
      )}
    </div>
  )
}
