import { useEffect, useState } from "react"
import { SearchIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { LibraryApprovalState } from "@/lib/library-schemas"
import { parseApprovalState } from "@/lib/library-schemas"
import type { LibraryFacets } from "@/server/services/library-service"
import type { ProjectListItem } from "@/server/services/project-service"
import { ASSET_STATE_META } from "./library-meta"

/**
 * The Library's filter row (FR-039/041): metadata search, asset type, project,
 * deliverable and approval state. Value-free presentation — every change is
 * reported back as a URL patch, because the filters live in the address bar
 * (a colleague can deep-link a filtered library).
 *
 * Reuses the native `select` treatment the triage bar introduced: the
 * shadcn/radix Select carries a keyboard trap worth not growing on a row of
 * four dropdowns.
 */
const selectClass =
  "h-9 rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none disabled:opacity-50"

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
  // project list changed since); keeping its place in the dropdown is honest
  // about "this filter is on" without guessing at its title.
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
          placeholder="Search files, types, tags…"
          maxLength={120}
        />
      </div>

      <select
        aria-label="Filter by asset type"
        className={selectClass}
        value={filters.type ?? ""}
        onChange={(event) => onPatch({ type: event.target.value || undefined })}
      >
        <option value="">All types</option>
        {/* The URL's word keeps its place even if no current asset carries it. */}
        {[
          ...new Set(
            [filters.type, ...facets.assetTypes].filter(
              (type) => type !== undefined
            )
          ),
        ].map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by project"
        className={selectClass}
        value={filters.project ?? ""}
        onChange={(event) =>
          onPatch({ project: event.target.value || undefined })
        }
      >
        <option value="">All projects</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.title}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by deliverable"
        className={selectClass}
        value={filters.deliverable ?? ""}
        disabled={!filters.project}
        onChange={(event) =>
          onPatch({ deliverable: event.target.value || undefined })
        }
      >
        <option value="">
          {filters.project
            ? "All deliverables"
            : "Deliverables (pick a project)"}
        </option>
        {deliverableOptions.map((deliverable) => (
          <option key={deliverable.id} value={deliverable.id}>
            {deliverable.title}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by approval state"
        className={selectClass}
        value={filters.state ?? ""}
        onChange={(event) => {
          const value = event.target.value
          onPatch({ state: parseApprovalState(value) })
        }}
      >
        <option value="">Any approval state</option>
        {Object.entries(ASSET_STATE_META).map(([state, meta]) => (
          <option key={state} value={state}>
            {meta.label}
          </option>
        ))}
      </select>
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
