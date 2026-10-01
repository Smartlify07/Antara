import type { ReactNode } from "react"
import { TestimonialPanel } from "./testimonial-panel"

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-svh bg-background">
      <div className="grid min-h-svh lg:grid-cols-2">
        <section className="flex flex-col justify-center px-6 py-16 sm:px-16">
          <div className="mx-auto w-full max-w-sm">{children}</div>
        </section>
        <TestimonialPanel />
      </div>
    </main>
  )
}
