import { QueryClient } from "@tanstack/react-query"

/**
 * Shared client for server state.
 *
 * Deliberately *not* integrated with the router's SSR pipeline. Everything
 * here is fetched after hydration on the client, which keeps this a plain
 * React provider with no per-request wiring to get wrong.
 *
 * The trade: lists are no longer present in the server-rendered HTML, so they
 * arrive a beat later than a loader would deliver them. For an authenticated
 * app behind a session that's an acceptable price for not having to reason
 * about where a cache lives across requests.
 *
 * Module scope is safe precisely because nothing queries during SSR: the
 * cache stays empty on the server, so one request's data can never be handed
 * to another. If that ever changes — a query prefetched in a loader — this
 * needs to move inside the request.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't refetch on every mount; mutations invalidate explicitly.
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})
