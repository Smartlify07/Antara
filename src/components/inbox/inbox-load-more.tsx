import { useEffect, useRef } from "react"
import { useInView } from "framer-motion"

/**
 * The infinite-scroll sentinel. It fetches the next page while it is near the
 * viewport (200px of headroom, so the rows land before the reader reaches the
 * bottom) and reports the end honestly once the cursor runs out.
 */
export function InboxLoadMore({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
}) {
  const sentinel = useRef<HTMLDivElement | null>(null)
  const inView = useInView(sentinel, { margin: "0px 0px 200px 0px" })

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) onLoadMore()
  }, [inView, hasNextPage, isFetchingNextPage, onLoadMore])

  return (
    <div ref={sentinel} className="py-3 text-center">
      {isFetchingNextPage ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Loading older notifications…
        </p>
      ) : hasNextPage ? (
        <span className="text-xs text-transparent" aria-hidden>
          More
        </span>
      ) : (
        <p className="text-xs text-muted-foreground">
          You&rsquo;re all caught up.
        </p>
      )}
    </div>
  )
}
