import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"

const plans = [
  {
    name: "Starter",
    audience: "For solo creators",
    price: "$0",
    cta: "variant-outline" as const,
    features: [
      "1 workspace",
      "Up to 3 projects",
      "2GB asset storage",
      "Version tracking",
      "Comments and feedback",
    ],
  },
  {
    name: "Studio",
    audience: "For creative teams",
    price: "$19",
    badge: "Popular",
    cta: "variant-primary" as const,
    features: [
      "Everything in Starter",
      "Unlimited projects",
      "100GB asset storage",
      "Approval workflows",
      "Client review links",
      "Notifications and deadlines",
      "Team roles and permissions",
      "Priority support",
    ],
  },
  {
    name: "Agency",
    audience: "For growing agencies",
    price: "$49",
    cta: "variant-outline" as const,
    features: [
      "Everything in Studio",
      "Unlimited asset storage",
      "Multiple workspaces",
      "Advanced reporting",
      "Audit history",
      "SSO and security controls",
      "Dedicated onboarding",
    ],
  },
]

export default function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-24 py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-md space-y-6">
          <h2 className="text-4xl font-medium tracking-tight text-balance text-muted-foreground lg:text-5xl">
            <span className="text-foreground">Start free.</span> <br /> Upgrade
            as your team grows.
          </h2>
        </div>

        <div className="mt-12 grid gap-6 border *:p-8 max-lg:mx-auto max-lg:max-w-sm lg:mt-20 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={
                plan.badge
                  ? "relative flex flex-col gap-8 bg-card shadow-xl max-lg:border-y lg:border-x"
                  : "flex flex-col gap-8 max-lg:border-b lg:border-r " +
                    (plan.name === "Agency"
                      ? "max-lg:border-t lg:border-l"
                      : "")
              }
            >
              {plan.badge ? (
                <div className="absolute top-0 right-0 w-fit translate-x-px -translate-y-px rounded-bl bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-200 inset-ring inset-ring-foreground/10 [corner-shape:bevel]">
                  {plan.badge}
                </div>
              ) : null}

              <div>
                <p className="text-lg font-medium">{plan.name}</p>
                <p className="text-lg font-medium text-muted-foreground">
                  {plan.audience}
                </p>

                <div className="my-8 block text-4xl font-medium tracking-tight">
                  {plan.price}{" "}
                  <span className="text-lg text-muted-foreground">/mo</span>
                </div>

                <Button
                  asChild
                  variant={
                    plan.cta === "variant-outline" ? "outline" : "default"
                  }
                  className="w-full"
                >
                  <Link to="/signup" search={{ callbackURL: undefined }}>
                    Get Started
                  </Link>
                </Button>
              </div>

              <ul className="list-outside space-y-3 text-muted-foreground">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <Check className="size-3 text-muted-foreground" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
