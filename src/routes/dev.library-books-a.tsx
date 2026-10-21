import { createFileRoute } from "@tanstack/react-router"
import LibraryFoldersA from "@/components/library/folder-experiments/variant-a"

export const Route = createFileRoute("/dev/library-books-a")({
  component: LibraryBooksAVariantPage,
})

/**
 * Dev-only gallery page for the library folder-cutout concept sprint,
 * variant A — "Cut pocket + standing covers". Mock data only; this page
 * exists so the variant can be reviewed beside the other variants' routes.
 */
function LibraryBooksAVariantPage() {
  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Concept sprint · mock data
        </p>
        <h1 className="mt-2 text-2xl font-medium tracking-tighter">
          Library folder cutouts — A · Cut pocket + standing covers
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Die-cut folders in the projects&rsquo; accent colours, asset titles
          peeking out of the pocket; the shelf stands each asset up as a cover
          and clicking lifts it to the record beneath.
        </p>

        <div className="mt-10">
          <LibraryFoldersA />
        </div>
      </div>
    </main>
  )
}
