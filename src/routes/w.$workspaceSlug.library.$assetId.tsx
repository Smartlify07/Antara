import { createFileRoute } from "@tanstack/react-router"
import { AssetDetailPage } from "@/components/library/asset-detail-page"

export const Route = createFileRoute("/w/$workspaceSlug/library/$assetId")({
  component: AssetRoute,
})

/** One asset's history (FR-040..044), URL-addressable like the reviews lane's pages. */
function AssetRoute() {
  const { workspaceId, workspace } = Route.useRouteContext()
  const { assetId } = Route.useParams()

  return (
    <AssetDetailPage
      workspaceSlug={workspace.slug}
      workspaceId={workspaceId}
      assetId={assetId}
    />
  )
}
