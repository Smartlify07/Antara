export default function StatsSection() {
  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <p className="max-w-4xl text-4xl font-medium tracking-tight text-balance text-muted-foreground lg:text-5xl">
          <span className="text-foreground">Built for teams that ship.</span>{" "}
          From first brief to final approval.
        </p>

        <div className="mt-32 grid gap-12 md:grid-cols-3 xl:mt-44">
          <div className="space-y-3 border-t pt-6">
            <div className="text-5xl font-semibold tracking-tight">-40%</div>
            <p className="text-muted-foreground">
              Less time chasing files and feedback
            </p>
          </div>
          <div className="space-y-3 border-t pt-6">
            <div className="text-5xl font-semibold tracking-tight">1</div>
            <p className="text-muted-foreground">
              Place for projects, assets, and approvals
            </p>
          </div>
          <div className="space-y-3 border-t pt-6">
            <div className="text-5xl font-semibold tracking-tight">∞</div>
            <p className="text-muted-foreground">
              Versions tracked, zero confusion
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
