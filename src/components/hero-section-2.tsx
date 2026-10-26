import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { HeroHeader } from "@/components/hero-section-2-header"
import LogoCloud from "@/components/hero-section-2-logo-cloud"
import { HeroAppPreview } from "@/components/hero-app-preview"

export default function HeroSection() {
  return (
    <>
      <HeroHeader />
      <main className="overflow-hidden">
        <section className="pt-44">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex justify-between gap-6 max-md:flex-col md:items-end lg:mt-16">
              <h1 className="max-w-2xl text-5xl font-medium tracking-tight text-balance md:text-6xl">
                One home for every creative project
              </h1>

              <Button className="w-fit" asChild size="lg">
                <Link to="/signup" search={{ callbackURL: undefined }}>
                  Get Started
                </Link>
              </Button>
            </div>

            <p className="mt-4 max-w-xl text-lg text-balance text-muted-foreground">
              Antara keeps projects, tasks, assets, versions, feedback, and
              approvals in one place — so your team stops chasing files across
              chat threads and drives.
            </p>

            <div className="relative -mx-2 mt-8 overflow-hidden rounded-3xl bg-black p-2 max-sm:-mr-56 sm:mt-12">
              <div className="relative rounded-2xl bg-background p-2 shadow-2xl ring shadow-black/55 ring-foreground/6.5 before:absolute before:-inset-px before:z-10 before:size-56 before:rounded-tl-2xl before:border-t before:border-l before:border-foreground/10 before:mask-radial-[100%_60%] before:mask-radial-from-65% before:mask-radial-at-top-left before:ring-foreground">
                <div className="absolute inset-0 z-1 rounded-2xl bg-foreground/2"></div>
                <HeroAppPreview className="relative" />
              </div>
            </div>
          </div>
        </section>
        <LogoCloud />
      </main>
    </>
  )
}
