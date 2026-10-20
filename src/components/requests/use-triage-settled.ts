import { useQueryClient } from "@tanstack/react-query"
import { requestKeys } from "@/lib/queries/requests"

/**
 * The one invalidation every triage action settles with: any write repaints
 * the whole request-scoped family (thread, card, inbox, sidebar badge) —
 * they are all facets of the same record.
 */
export function useTriageSettled() {
  const queryClient = useQueryClient()
  return async () => {
    await queryClient.invalidateQueries({ queryKey: requestKeys.all })
  }
}
