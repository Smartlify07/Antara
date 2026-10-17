import { createFileRoute } from "@tanstack/react-router"
import { ReviewsPage } from "@/components/reviews/reviews-page"

export const Route = createFileRoute("/w/$workspaceSlug/reviews")({
  component: ReviewsRoute,
})

/** The Reviews queue (FR-030): workspace-scoped like every other section —
 * the route context supplies the workspace each page sits inside. */
function ReviewsRoute() {
  const { workspaceId } = Route.useRouteContext()
  const { workspaceSlug } = Route.useParams()

  return <ReviewsPage workspaceSlug={workspaceSlug} workspaceId={workspaceId} />
}
