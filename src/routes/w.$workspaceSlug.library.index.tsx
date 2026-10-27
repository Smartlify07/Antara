import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { AlertCircleIcon, ImagesIcon } from "lucide-react"
import { AppLoading } from "@/components/app-loading"
import {
  AssetBook,
  LibraryFolderWall,
  folderMetaLine,
} from "@/components/library/library-folders"
import {
  groupAssetsIntoFolders,
} from "@/components/library/folder-grouping"
import {
  clearLibraryFolderScope,
  useLibraryFolderScope,
} from "@/components/library/folder-scope"
import { LibraryFilters } from "@/components/library/library-filters"
import type { LibraryFilterPatch } from "@/components/library/library-filters"
import { LibraryResultCount } from "@/components/library/library-result-count"
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
 * in place.
 *
 * Two roads lead to the same shelf, by design. The URL filters stay the
 * deep-link contract: every filter word lives in the address bar (the
 * layout validates it), so a filtered view survives a refresh and can be
 * linked from a deliverable card. The cutouts take the other road: their
 * click carries the scope in memory (see `folder-scope`), so the folder's
 * shelf opens from the data the wall already holds — the previous key's
 * rows paint the next view the same tick, and the scoped fetch only
 * freshens the answer behind it. The address bar's words always win when
 * they are present.
 *
 * react-query rather than a route loader, like every other list in the app:
 * the fetch rides the filters key, so the wire trip carries exactly what
 * the visible state needs. The list payload carries each asset's whole
 * version timeline (see `library-service`), so an opened book costs no
 * second fetch.
 */
function LibraryPage() {
  const { workspaceId, workspace } = Route.useRouteContext()
  const workspaceSlug = workspace.slug
  const filters = Route.useSearch()
  const navigate = Route.useNavigate()

  /**
   * The card shortcut's target: the project a cutout's click asked for. It
   * governs only when the URL says nothing at all — a filter word anywhere
   * (including a deep-linked project) takes the shelf back to the honest
   * contract.
   */
  const scope = useLibraryFolderScope()
  const scopedProject =
    scope && scope.workspaceSlug === workspaceSlug
      ? (!filters.q &&
        !filters.type &&
        !filters.project &&
        !filters.deliverable &&
        !filters.state
          ? scope.projectId
          : null)
      : null
  const targetProject = filters.project ?? scopedProject ?? undefined

  const seedClient = useQueryClient()

  const { data, isPending, error } = useQuery({
    ...libraryQuery(workspaceId, {
      q: filters.q,
      assetType: filters.type,
      projectId: targetProject,
      deliverableId:
        filters.project && filters.deliverable
          ? filters.deliverable
          : undefined,
      approvalState: filters.state,
    }),
    // A project target moves the key; the previous key's rows — the ones
    // the wall was showing, or the folder it came from — paint the next
    // shelf immediately (a subset of what is already on screen), so the
    // folder opens without a wait while the scoped fetch freshens behind
    // it. Nothing here holds a non-project filter's answer over: those
    // wait for their own true rows. The click seeds the key's cache with
    // those same rows (see `seedScopedShelf`), which is what makes a fresh
    // page's first folder click — a brand-new observer with nothing kept —
    // open without a loading wait too.
    ...(targetProject ? { placeholderData: keepPreviousData } : {}),
  })

  // The project facet (and the deliverables inside the picked one) ride
  // their existing queries — the same data the wall and the Work tab cache
  // already hold, composed rather than duplicated. The memory-scoped shelf
  // offers its folder's deliverables too: picking one hands the scope over
  // to the URL and continues as a filter.
  const {
    data: projectsData,
    isPending: projectsPending,
  } = useQuery(projectsQuery(workspaceId))
  const projects = projectsData ?? []
  const { data: deliverableData } = useQuery({
    ...projectDeliverablesQuery(workspaceId, targetProject ?? ""),
    enabled: Boolean(targetProject),
  })
  const deliverables = (deliverableData?.deliverables ?? []).map(
    (deliverable) => ({ id: deliverable.id, title: deliverable.title })
  )

  // Typing writes the URL only after a pause, so a "keynotes" search is one
  // navigation, not eight. replace: true keeps the filter row out of the
  // back stack — one browser-back step returns to the pre-filter page. A
  // settled word is a filter decision, so the card scope retires from it.
  const searchTimer = useRef<number | null>(null)
  function scheduleSearch(term: string) {
    if (term.trim()) {
      clearLibraryFolderScope()
    }
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
    // Any filter decision takes over from the card's scope — the shelf it
    // names is the URL's business from here on.
    clearLibraryFolderScope()
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

  /**
   * The cutout's click hands the folder's rows to the scoped key's cache
   * before its observer exists: the wall's payload is a superset of what
   * the shelf shows, so the first read finds its answer already there.
   * The fetch still runs — this is the wall's knowledge, not the scoped
   * one — invalidated after the write so it answers for real behind the
   * paint.
   */
  function seedScopedShelf(folderId: string) {
    if (!data) return
    seedClient.setQueryData(
      libraryQuery(workspaceId, { projectId: folderId }).queryKey,
      {
        ...data,
        assets: data.assets.filter((asset) => asset.projectId === folderId),
      }
    )
    void seedClient.invalidateQueries({
      queryKey: libraryQuery(workspaceId, { projectId: folderId }).queryKey,
    })
  }

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
  const wallMode = !hasFilter && !scopedProject

  // The wall's folders: the assets folded into the projects they live in —
  // a folder is a project, titled by its name, whether or not files have
  // arrived yet. A project scope (and nothing else) is that folder's own
  // shelf, so its header answers "where am I" with the folder's identity.
  // The shelf reads the folder's own books rather than the payload's rows:
  // while the scope's fetch freshens behind the kept-previous placeholder,
  // the rows on hand may be the wall's (a superset), and the folder pick
  // is what makes them honest for this shelf.
  const folders = useMemo(
    () => groupAssetsIntoFolders(assets, projects),
    [assets, projects]
  )
  const scopedFolder = useMemo(
    () =>
      targetProject
        ? (folders.find((folder) => folder.id === targetProject) ?? null)
        : null,
    [folders, targetProject]
  )
  const projectOnly =
    Boolean(targetProject) &&
    !filters.q &&
    !filters.type &&
    !filters.deliverable &&
    !filters.state
  const shelfAssets = scopedFolder ? scopedFolder.assets : assets

  // One book open at a time; Escape closes it, whichever cell holds focus —
  // and switching folders (card click, filter change) closes it for good.
  const [expandedId, setExpandedId] = useState<string | null>(null)
  useEffect(() => {
    setExpandedId(null)
  }, [targetProject])
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
      : shelfAssets.length === 0 || unscopableDeliverable)
  // A scoped folder with no files is an empty folder, not a failed filter.
  const projectScopedEmpty = projectOnly && shelfAssets.length === 0
  const onScopedShelf = Boolean(scopedProject) || Boolean(filters.project)

  // One arrival: the header, the filters, and the wall/shelf all read the
  // list, so the page paints once, complete — the shell's pulsing logo
  // covers the fetch. Off the wall, the project facet and its deliverable
  // pick-list stay out of the gate: they only drive search, and gating on
  // them would flash the whole page on every scope the viewer switches to.
  if (loading) return <AppLoading />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        {(hasFilter || scopedProject) && (
          <Link
            to="/w/$workspaceSlug/library"
            params={{ workspaceSlug }}
            onClick={clearLibraryFolderScope}
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
        filters={{ ...filters, project: targetProject }}
        facets={facets}
        projects={projects}
        deliverables={deliverables}
        total={data?.total}
        onSearch={scheduleSearch}
        onPatch={patchFilters}
      />

      <LibraryResultCount
        shown={data?.assets.length ?? 0}
        total={data?.total ?? 0}
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
          onSeedScope={seedScopedShelf}
        />
      )}

      {!wallMode && shelfAssets.length > 0 && !unscopableDeliverable && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {shelfAssets.map((asset) => (
            <AssetBook
              key={asset.id}
              workspaceSlug={workspaceSlug}
              asset={asset}
              showProject={!onScopedShelf}
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
