/**
 * The Linear-style request dialog: opens immediately on card click — no
 * router involvement at all. The content is fed from the data the card
 * already carries (the grid owns the one list fetch), so nothing loads on
 * open. Radix/shadcn Dialog gives the transition; only the conversation
 * thread fetches as it mounts, since it lives off the list payload.
 */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  RequestDetailBody,
  RequestMetaRow,
  requestTitleClass,
} from "@/components/requests/request-detail"
import type { RequestListItem } from "@/server/services/request-service"

export function RequestDetailDialog({
  workspaceId,
  workspaceSlug,
  request,
  canTriage,
  onClose,
}: {
  workspaceId: string
  workspaceSlug: string
  /** The list item whose card opened this dialog — already on the client. */
  request: RequestListItem | null
  canTriage: boolean
  onClose: () => void
}) {
  const open = request !== null

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="flex max-h-[85vh] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl lg:max-w-4xl">
        <div className="min-h-0 flex-1 overflow-y-auto p-6 pb-0">
          {request ? (
            <>
              <DialogTitle className={requestTitleClass}>
                {request.title}
              </DialogTitle>
              <DialogDescription asChild>
                <RequestMetaRow request={request} />
              </DialogDescription>

              <RequestDetailBody
                workspaceId={workspaceId}
                workspaceSlug={workspaceSlug}
                request={request}
                canTriage={canTriage}
                threadFlush
              />
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
