import { createFileRoute } from "@tanstack/react-router"
import { DeliverablesFolderA } from "@/components/projects/details/folder-experiments/variant-a"
import { DeliverablesFolderB } from "@/components/projects/details/folder-experiments/variant-b"
import { DeliverablesFolderC } from "@/components/projects/details/folder-experiments/variant-c"

export const Route = createFileRoute("/dev/deliverables")({
  component: DeliverablesGallery,
})

/**
 * Concept-sprint gallery for the deliverables folder cutout — mock data
 * only, wired to nothing. Each variant owns one folder element that opens
 * its own dialog; the folder lives here in isolation so the three
 * interaction geometries can be compared side by side before one is
 * integrated into the project details page.
 */
function DeliverablesGallery() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <header className="mb-14">
        <p className="text-xs font-medium text-muted-foreground">
          Concept sprint · mock data
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Deliverables folder cutout
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Three takes on the same brief: a folder element that opens the work
          dialog, deliverables as threads instead of bordered cards, and
          versions reachable without nested accordions. Pick a lane; the winner
          integrates with the real queries.
        </p>
      </header>

      <div className="flex flex-col gap-16">
        <section className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Variant A
            </p>
            <h2 className="mt-1 text-sm font-semibold">Folder tab + stage</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              A die-cut folder tab hanging off the edge. The dialog is a
              deliverable rail plus one live stage: versions flip in place
              through a filmstrip, no accordion anywhere.
            </p>
          </div>
          <DeliverablesFolderA />
        </section>

        <section className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Variant B
            </p>
            <h2 className="mt-1 text-sm font-semibold">
              Paper stack + one rail
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              A layered folder with sheets peeking out. One shared thread rail
              per deliverable — tasks, comments and version nodes in order; a
              single controlled expansion keeps the nesting flat.
            </p>
          </div>
          <DeliverablesFolderB />
        </section>

        <section className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Variant C
            </p>
            <h2 className="mt-1 text-sm font-semibold">
              Punched inset + version pager
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              A folder silhouette stamped into the surface. The dialog is a
              two-pane cabinet: deliverables left, one detail right, versions a
              flat drill-down paged through with ‹ › instead of expanders.
            </p>
          </div>
          <DeliverablesFolderC />
        </section>
      </div>
    </main>
  )
}
