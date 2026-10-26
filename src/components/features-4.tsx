import { Card } from "@/components/ui/card"

export default function Features() {
  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="max-w-4xl text-4xl font-medium tracking-tight text-balance text-muted-foreground">
          <span className="text-foreground">Everyone sees the same truth.</span>{" "}
          <br /> Owners, deadlines, and approvals at a glance.
        </h2>
        <div className="mt-8 grid gap-6 md:mt-16 md:grid-cols-2 md:gap-3 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="relative aspect-3/2 overflow-hidden ring-0 after:pointer-events-none after:absolute after:inset-0 after:rounded-xl after:border after:border-foreground/5">
              <div className="relative z-10 max-w-md p-8">
                <p className="text-lg text-balance text-foreground/75">
                  <span className="font-medium text-foreground">
                    Assignments with context.{" "}
                  </span>{" "}
                  Tasks carry the brief, the files, and the deadline — so nobody
                  works from memory.
                </p>
              </div>

              <img
                src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2070&auto=format&fit=crop"
                alt="creative team working together"
                width={800}
                height={800}
                loading="lazy"
                className="absolute inset-0 size-full object-cover object-[50%_85%] opacity-50"
              />
            </Card>
          </div>

          <Card className="relative h-full min-h-96 overflow-hidden bg-zinc-100">
            <div className="relative z-10 max-w-sm p-8">
              <p className="text-lg text-balance text-zinc-950/75 selection:bg-zinc-950 selection:text-white">
                <span className="font-medium text-zinc-950">
                  Nudges, not noise.{" "}
                </span>{" "}
                Reminders reach the right person before a deadline slips.
              </p>
            </div>
            <DynamicIslandIllustration />
          </Card>
        </div>
      </div>
    </section>
  )
}

function DynamicIslandIllustration() {
  return (
    <div
      aria-hidden
      className="absolute inset-x-8 bottom-0 z-1 mx-auto mt-auto h-2/3 w-10/12 origin-bottom scale-95 rounded-t-[4rem] border border-black/5 bg-black/2.5 mask-b-from-90% px-4 pt-4"
    >
      <div className="h-full overflow-hidden rounded-t-[3rem] bg-white p-3 shadow-xl ring shadow-black/6.5 ring-black/10">
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
                  alt="Team member"
                  width={136}
                  height={136}
                  loading="lazy"
                  className="size-full object-cover"
                />
              </div>
              <div className="py-1 pr-4">
                <div className="text-sm font-medium text-black">Maya Chen</div>
                <div className="mt-1.5 flex items-center gap-3">
                  <div>
                    <div className="text-xs text-black/50">My tasks</div>
                    <div className="mt-0.5 text-sm font-semibold text-black">
                      5
                    </div>
                  </div>
                  <div className="h-7 w-px bg-border" />
                  <div>
                    <div className="text-xs text-black/50">Next due</div>
                    <div className="mt-0.5 text-sm font-semibold text-black">
                      Fri
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
