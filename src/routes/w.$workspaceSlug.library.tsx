import { Outlet, createFileRoute } from "@tanstack/react-router"
import { parseLibrarySearch } from "@/lib/library-schemas"

/**
 * Layout for the Library's routes (FR-039..044). The filtered list lives in
 * the index child and one asset's detail in its sibling, both inside the
 * workspace shell — same shape as the requests lane.
 *
 * The search params are validated here rather than on the index child, so a
 * filter deep link (`?project=…&deliverable=…` from a deliverable card) has
 * one declared schema at the entry every link can target.
 */
export const Route = createFileRoute("/w/$workspaceSlug/library")({
  validateSearch: (search: Record<string, unknown>) =>
    parseLibrarySearch(search),
  component: () => <Outlet />,
})
