import { Link } from "@tanstack/react-router"
import { Logo } from "@/components/logo"

const footerLinks = [
  {
    name: "Product",
    links: [
      { href: "#features", label: "Features" },
      { href: "#pricing", label: "Pricing" },
      { href: "#faq", label: "FAQ" },
    ],
  },
  {
    name: "Get started",
    links: [
      { href: "/signup", label: "Sign up" },
      { href: "/login", label: "Log in" },
    ],
  },
  {
    name: "Legal",
    links: [
      { href: "#", label: "Privacy Policy" },
      { href: "#", label: "Terms of Service" },
    ],
  },
]

export default function Footer() {
  return (
    <footer>
      <div className="mx-auto max-w-7xl space-y-16 px-6 pt-32 pb-6">
        <div className="grid grid-cols-2 gap-x-3 gap-y-12 sm:grid-cols-4 lg:grid-cols-6">
          <div className="col-span-full lg:col-span-3">
            <Link
              to="/"
              aria-label="go home"
              className="flex items-center gap-2"
            >
              <Logo className="size-7 text-foreground" />
              <span className="font-heading text-lg font-semibold tracking-tight">
                Antara
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              The collaborative home for creative projects — tasks, assets,
              versions, and approvals in one place.
            </p>
          </div>

          {footerLinks.map((linksGroup, groupIndex) => (
            <div key={groupIndex}>
              <span className="text-sm text-foreground">{linksGroup.name}</span>
              <ul className="mt-4 list-inside space-y-4">
                {linksGroup.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    {link.href.startsWith("/") ? (
                      <Link
                        to={link.href}
                        className="text-sm text-muted-foreground duration-150 hover:text-primary"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground duration-150 hover:text-primary"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-24 grid gap-x-3 gap-y-6 border-t pt-6 sm:grid-cols-2">
          <span className="block text-sm text-muted-foreground">
            Built for creative teams.
          </span>
          <span className="block text-sm text-muted-foreground sm:text-right">
            &copy; Antara 2025 - Present
          </span>
        </div>
      </div>
    </footer>
  )
}
