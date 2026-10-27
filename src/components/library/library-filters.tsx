import { useEffect, useState } from "react"
import { SearchIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Chip, ChipOption } from "@/components/projects/chip"
import { cn } from "@/lib/utils"
import type { LibraryApprovalState } from "@/lib/library-schemas"
import { parseApprovalState } from "@/lib/library-schemas"
import type { LibraryFacets } from "@/server/services/library-service"
import type { ProjectListItem } from "@/server/services/project-service"
import { ASSET_STATE_META } from "./library-meta"

/**
 * The Library's filter row (FR-039/041): metadata search, asset type, project,
 * deliverable and approval state — the same pill pickers the project details
 * attribute row uses (`Chip`), instead of a dropdown row. Value-free
 * presentation — every change is reported back as a URL patch, because the
 * filters live in the address bar (a colleague can deep-link a filtered
 * library). Each pill's first row is its "off" choice.
 */
export interface LibraryFilterPatch {
  type?: string
  project?: string
  deliverable?: string
  state?: LibraryApprovalState
}

export function LibraryFilters({
  filters,
  facets,
  projects,
  deliverables,
  total,
  onSearch,
  onPatch,
}: {
  /** The URL's current word for each filter (absent words mean off). */
  filters: {
    q?: string | undefined
    type?: string | undefined
    project?: string | undefined
    deliverable?: string | undefined
    state?: LibraryApprovalState | undefined
  }
  facets: LibraryFacets
  projects: ProjectListItem[]
  /** The selected project's deliverables, empty until one is picked. */
  deliverables: { id: string; title: string }[]
  /**
   * How many assets the current scope holds — the search placeholder's
   * number ("Search 1,248 assets…"). The count is what makes search feel
   * like a place rather than a filter; absent (still loading) falls back to
   * the generic placeholder.
   */
  total?: number
  /** Debounced upstream — the URL only moves when typing settles. */
  onSearch: (term: string) => void
  onPatch: (patch: LibraryFilterPatch) => void
}) {
  // The search box is a URL-backed input: it types locally so it never
  // lags, reports settled values upstream, and follows the address bar back
  // — a clear-all from outside (or a fresh deep link) resets it honestly.
  const [term, setTerm] = useState(filters.q ?? "")
  useEffect(() => {
    setTerm(filters.q ?? "")
  }, [filters.q])

  // A deep link may name a deliverable the panel hasn't loaded (or whose
  // project list changed since); keeping its place in the pill's list is
  // honest about "this filter is on" without guessing at its title.
  const deliverableOptions = [...deliverables]
  if (
    filters.deliverable &&
    !deliverableOptions.some(
      (deliverable) => deliverable.id === filters.deliverable
    )
  ) {
    deliverableOptions.unshift({
      id: filters.deliverable,
      title: "Selected deliverable",
    })
  }
  const selectedDeliverable = deliverableOptions.find(
    (deliverable) => deliverable.id === filters.deliverable
  )
  // The URL's word keeps its place even if no current asset carries it.
  const typeOptions = [
    ...new Set(
      [filters.type, ...facets.assetTypes].filter((type) => type !== undefined)
    ),
  ]
  const hasActiveFilters =
    Boolean(filters.q) ||
    Boolean(filters.type) ||
    Boolean(filters.project) ||
    Boolean(filters.deliverable) ||
    Boolean(filters.state)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-56 flex-1 sm:max-w-xs">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-label="Search the library"
          className="pl-8"
          value={term}
          onChange={(event) => {
            setTerm(event.target.value)
            onSearch(event.target.value)
          }}
          placeholder={
            total !== undefined && total > 0
              ? `Search ${total.toLocaleString("en-US")} assets…`
              : "Search files, types, tags…"
          }
          maxLength={120}
        />
      </div>

      <Chip placeholder="All types" label={filters.type}>
        <div className="flex flex-col gap-0.5">
          <ChipOption
            selected={!filters.type}
            onSelect={() => onPatch({ type: undefined })}
            title="All types"
          />
          {typeOptions.map((type) => (
            <ChipOption
              key={type}
              selected={filters.type === type}
              onSelect={() => onPatch({ type })}
              title={type}
            />
          ))}
        </div>
      </Chip>

      <Chip
        placeholder="All projects"
        label={
          filters.project
            ? (projects.find((project) => project.id === filters.project)
                ?.title ?? filters.project)
            : undefined
        }
      >
        <div className="flex flex-col gap-0.5">
          <ChipOption
            selected={!filters.project}
            onSelect={() => onPatch({ project: undefined })}
            title="All projects"
          />
          {projects.map((project) => (
            <ChipOption
              key={project.id}
              selected={filters.project === project.id}
              onSelect={() => onPatch({ project: project.id })}
              title={project.title}
            />
          ))}
        </div>
      </Chip>

      {filters.project ? (
        <Chip placeholder="All deliverables" label={selectedDeliverable?.title}>
          <div className="flex flex-col gap-0.5">
            <ChipOption
              selected={!filters.deliverable}
              onSelect={() => onPatch({ deliverable: undefined })}
              title="All deliverables"
            />
            {deliverableOptions.map((deliverable) => (
              <ChipOption
                key={deliverable.id}
                selected={filters.deliverable === deliverable.id}
                onSelect={() => onPatch({ deliverable: deliverable.id })}
                title={deliverable.title}
              />
            ))}
          </div>
        </Chip>
      ) : (
        // No project picked yet: the pill keeps the row's rhythm, inert.
        <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground ring-1 ring-border">
          Deliverables (pick a project)
        </span>
      )}

      <Chip
        placeholder="Any approval state"
        label={
          filters.state ? ASSET_STATE_META[filters.state].label : undefined
        }
      >
        <div className="flex flex-col gap-0.5">
          <ChipOption
            selected={!filters.state}
            onSelect={() => onPatch({ state: undefined })}
            title="Any approval state"
          />
          {Object.entries(ASSET_STATE_META).map(([state, meta]) => (
            <ChipOption
              key={state}
              selected={filters.state === state}
              onSelect={() =>
                void onPatch({ state: parseApprovalState(state) })
              }
              title={meta.label}
            >
              <span
                aria-hidden
                className={cn("size-3.5 shrink-0 rounded-full", meta.dot)}
              />
            </ChipOption>
          ))}
        </div>
      </Chip>

      {hasActiveFilters && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-9 text-xs text-muted-foreground"
          onClick={() => {
            setTerm("")
            onSearch("")
            onPatch({
              type: undefined,
              project: undefined,
              deliverable: undefined,
              state: undefined,
            })
          }}
        >
          Clear filters
        </Button>
      )}
    </div>
  )
}
