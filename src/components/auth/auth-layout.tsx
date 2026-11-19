import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { Logo } from "@/components/logo"
import { TestimonialPanel } from "./testimonial-panel"
import type { AuthPanelVariant } from "./testimonial-backdrop"

export function AuthLayout({
  children,
  panel = "photo",
}: {
  children: ReactNode
  panel?: AuthPanelVariant
}) {
  return (
    <main className="min-h-svh bg-background">
      <div className="grid min-h-svh lg:grid-cols-2">
        <section className="relative flex flex-col justify-center px-6 py-20 sm:px-16">
          <Link
            to="/"
            aria-label="Antara home"
            className="absolute top-7 left-6 flex items-center gap-2 sm:left-16"
          >
            <Logo className="size-6 text-brand" />
            <span className="text-base font-semibold tracking-tight">
              Antara
            </span>
          </Link>
          <div className="mx-auto w-full max-w-sm">{children}</div>
        </section>
        <TestimonialPanel variant={panel} />
      </div>
    </main>
  )
}
