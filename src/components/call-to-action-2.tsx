import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"

export default function CallToAction() {
  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex items-center justify-center gap-6 max-lg:flex-col max-lg:text-center lg:items-end lg:justify-between">
          <h2 className="max-w-4xl text-5xl font-semibold tracking-tight text-balance xl:text-6xl">
            Bring your next project home
          </h2>

          <Button asChild size="lg">
            <Link to="/signup" search={{ callbackURL: undefined }}>
              Get Started
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
