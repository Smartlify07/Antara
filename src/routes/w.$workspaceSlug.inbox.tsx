import { createFileRoute } from "@tanstack/react-router"
import { InboxPage } from "@/components/inbox/inbox-page"

export const Route = createFileRoute("/w/$workspaceSlug/inbox")({
  component: InboxRoute,
})

/**
 * The workspace Inbox. The route is scope-checked by the workspace layout
 * (`w.$workspaceSlug.tsx`), so the page only carries the slug its queries
 * already speak.
 */
function InboxRoute() {
  const { workspaceSlug } = Route.useParams()

  return <InboxPage workspaceSlug={workspaceSlug} />
}
