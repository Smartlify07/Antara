import { Link } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { WorkspaceListItem } from "@/server/services/workspace-service"
import { SearchIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function WorkspaceSearch({
  workspaces,
  fullWidth = false,
}: {
  workspaces: WorkspaceListItem[]
  fullWidth?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    function onPointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("pointerdown", onPointerDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("pointerdown", onPointerDown)
    }
  }, [])

  const results = workspaces.filter((item) =>
    `${item.workspace.title} ${item.workspace.slug}`
      .toLowerCase()
      .includes(query.trim().toLowerCase())
  )

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "justify-start gap-2 font-normal text-muted-foreground",
          fullWidth ? "w-full" : "w-48 sm:w-64"
        )}
        aria-expanded={open}
        aria-label="Search workspaces"
      >
        <SearchIcon className="size-4 shrink-0" />
        <span className="truncate">Search workspaces…</span>
      </Button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-2 w-64 rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a workspace name…"
            aria-label="Filter workspaces"
          />
          <div className="mt-1 flex max-h-64 flex-col gap-0.5 overflow-y-auto">
            {results.map((item) => (
              <Link
                key={item.workspace.id}
                to="/w/$workspaceSlug/projects"
                params={{ workspaceSlug: item.workspace.slug }}
                onClick={() => {
                  setOpen(false)
                  setQuery("")
                }}
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                {item.workspace.avatarUrl ? (
                  <img
                    src={item.workspace.avatarUrl}
                    alt=""
                    className="size-7 shrink-0 rounded-lg object-cover ring-1 ring-black/10 ring-inset"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-medium text-primary-foreground"
                  >
                    {(item.workspace.title.trim()[0] ?? "W").toUpperCase()}
                  </span>
                )}
                <span className="flex flex-1 flex-col truncate">
                  <span className="truncate font-medium">
                    {item.workspace.title}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    /w/{item.workspace.slug}
                  </span>
                </span>
              </Link>
            ))}
            {results.length === 0 && (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                {workspaces.length === 0 ? (
                  <>
                    No workspaces yet.{" "}
                    <Link
                      to="/workspaces/new"
                      onClick={() => setOpen(false)}
                      className="font-medium text-primary underline underline-offset-4"
                    >
                      Create one
                    </Link>
                  </>
                ) : (
                  "No workspaces match."
                )}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
