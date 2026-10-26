import { createFileRoute } from "@tanstack/react-router"

import HeroSection from "@/components/hero-section-2"
import FeaturesGrid from "@/components/features-3"
import FeaturesHighlights from "@/components/features-4"
import ContentSection from "@/components/content-2"
import StatsSection from "@/components/stats-2"
import Pricing from "@/components/pricing-2"
import FAQs from "@/components/faqs-1"
import CallToAction from "@/components/call-to-action-2"
import Footer from "@/components/footer-2"

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Antara — One home for every creative project" },
      {
        name: "description",
        content:
          "Antara keeps projects, tasks, assets, versions, feedback, and approvals in one place for creative teams.",
      },
    ],
  }),
  component: LandingPage,
})

function LandingPage() {
  return (
    <div className="bg-background min-h-svh">
      <HeroSection />
      <FeaturesGrid />
      <FeaturesHighlights />
      <ContentSection />
      <StatsSection />
      <Pricing />
      <FAQs />
      <CallToAction />
      <Footer />
    </div>
  )
}
