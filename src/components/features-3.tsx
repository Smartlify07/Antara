import { Card } from "@/components/ui/card"
import { ArrowRight, Check, FolderOpen, Plus, Search } from "lucide-react"

const THUMB =
  "https://images.unsplash.com/photo-1656012710277-e103fe942e30?q=80&w=2342&auto=format&fit=crop"

export default function Features() {
  return (
    <section id="features" className="scroll-mt-24 py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="max-w-4xl text-4xl font-medium tracking-tight text-balance text-muted-foreground">
          <span className="text-foreground">
            Feedback where the files live.
          </span>{" "}
          <br /> No more hunting through chat threads.
        </h2>
        <div className="mt-8 grid gap-x-3 gap-y-6 **:data-[slot=card]:bg-background md:mt-16 md:grid-cols-2 lg:grid-cols-3">
          <div className="row-span-2 grid grid-cols-subgrid gap-4">
            <Card className="relative aspect-9/12 overflow-hidden">
              <LibrarySearchIllustration />
              <img
                src={THUMB}
                alt="abstract background"
                width={670}
                height={670}
                loading="lazy"
                className="absolute inset-0 size-full object-cover"
              />
            </Card>

            <p className="text-balance text-muted-foreground">
              <span className="text-foreground">One shared library. </span>{" "}
              Every asset lives with the project it belongs to.
            </p>
          </div>

          <div className="row-span-2 grid grid-cols-subgrid gap-4">
            <Card className="relative aspect-9/12 overflow-hidden bg-zinc-200!">
              <ApprovalIllustration />
            </Card>

            <p className="text-balance text-muted-foreground">
              <span className="text-foreground">Version tracking. </span> Always
              know which cut is latest and which is approved.
            </p>
          </div>

          <div className="row-span-2 grid grid-cols-subgrid gap-4">
            <Card className="relative aspect-9/12 overflow-hidden">
              <ReviewPanelIllustration />
            </Card>

            <p className="text-balance text-muted-foreground">
              <span className="text-foreground">Approvals in-app. </span>{" "}
              Clients review, comment, and sign off without leaving the
              platform.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function ReviewPanelIllustration() {
  return (
    <div className="absolute inset-0 z-1 m-auto h-fit w-9/12 max-w-72 rounded-2xl bg-white p-3 shadow-xl ring shadow-black/25 ring-black/10">
      <div className="text-xs font-medium text-black">
        Autumn campaign · Final cut
      </div>
      <div className="text-[10px] text-black/50">
        Version 3 of 3 · Uploaded 2h ago
      </div>

      <div className="mt-2.5 aspect-video w-full overflow-hidden rounded-lg bg-zinc-100">
        <img
          src="https://images.unsplash.com/photo-1656012710277-e103fe942e30?q=80&w=670&auto=format&fit=crop"
          alt=""
          width={536}
          height={301}
          loading="lazy"
          className="size-full object-cover"
        />
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="rounded-lg bg-zinc-950 px-3 py-1.5 text-[11px] font-medium text-white">
          Approve
        </div>
        <div className="rounded-lg bg-black/5 px-3 py-1.5 text-[11px] font-medium text-black/70">
          Request changes
        </div>
      </div>
    </div>
  )
}

function LibrarySearchIllustration() {
  return (
    <div aria-hidden className="absolute inset-8 z-1 m-auto h-fit scale-95">
      <div className="mt-auto h-fit rounded-3xl bg-card p-3 shadow-xl ring shadow-black/25 ring-foreground/15">
        <div className="flex items-center gap-2 p-2 pb-3 text-sm text-muted-foreground">
          <Search className="size-4" />
          <span>Search 1,248 assets…</span>
        </div>
        <div className="flex justify-between gap-3">
          <div className="flex items-center gap-1">
            <div className="flex size-7 cursor-pointer rounded-full *:m-auto *:size-4 hover:bg-muted">
              <Plus />
            </div>
            <div className="flex size-7 cursor-pointer rounded-full *:m-auto *:size-4 hover:bg-muted">
              <FolderOpen />
            </div>
          </div>

          <div className="flex size-7 cursor-pointer rounded-full bg-foreground text-background *:m-auto *:size-4 hover:brightness-110">
            <ArrowRight />
          </div>
        </div>
      </div>
    </div>
  )
}

function ApprovalIllustration() {
  return (
    <div
      aria-hidden
      className="absolute inset-x-8 bottom-0 z-1 mx-auto mt-auto h-2/3 w-10/12 origin-bottom scale-95 rounded-t-[4rem] border border-black/5 bg-black/2.5 px-4 pt-4"
    >
      <div className="h-full overflow-hidden rounded-t-[3rem] bg-white p-3 shadow-lg ring shadow-black/15 ring-black/10">
        <div className="relative">
          <img
            src="https://images.unsplash.com/photo-1782366951390-d6798e902db7?q=80&w=1015&auto=format&fit=crop"
            alt=""
            width={500}
            height={500}
            loading="lazy"
            className="absolute inset-0 top-0 size-full object-cover opacity-45 blur-xl contrast-200"
          />
          <div className="relative rounded-[2.25rem] bg-white p-2 shadow-xl ring shadow-black/6.5 ring-black/10">
            <div className="flex gap-2">
              <div className="relative size-18 overflow-hidden rounded-[1.75rem] shadow-md before:absolute before:inset-0 before:rounded-[1.75rem] before:border before:border-black/20">
                <img
                  src="https://images.unsplash.com/photo-1782366951390-d6798e902db7?q=80&w=1015&auto=format&fit=crop"
                  alt="Final cut preview"
                  width={136}
                  height={136}
                  loading="lazy"
                  className="size-full object-cover"
                />
              </div>
              <div className="py-1 pr-4">
                <div className="text-sm font-medium text-black">
                  Final cut · v3
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <div>
                    <div className="text-xs text-black/50">Versions</div>
                    <div className="mt-0.5 text-sm font-semibold text-black">
                      3
                    </div>
                  </div>
                  <div className="h-7 w-px bg-border" />
                  <div>
                    <div className="text-xs text-black/50">Status</div>
                    <div className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-emerald-600">
                      <Check className="size-3.5" /> Approved
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
