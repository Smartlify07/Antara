import { Link } from "@tanstack/react-router"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"
import React from "react"

const menuItems = [
  { name: "Features", href: "#features" },
  { name: "Pricing", href: "#pricing" },
  { name: "FAQ", href: "#faq" },
]

export const HeroHeader = () => {
  const [menuState, setMenuState] = React.useState(false)

  React.useEffect(() => {
    if (!menuState) return

    const mediaQuery = window.matchMedia("(max-width: 1023px)")
    const updateOverflow = () => {
      document.documentElement.classList.toggle(
        "overflow-hidden",
        mediaQuery.matches
      )
    }

    updateOverflow()
    mediaQuery.addEventListener("change", updateOverflow)

    return () => {
      mediaQuery.removeEventListener("change", updateOverflow)
      document.documentElement.classList.remove("overflow-hidden")
    }
  }, [menuState])

  return (
    <header>
      <nav
        data-state={menuState && "active"}
        className="fixed top-0 z-20 w-full border-b bg-background max-lg:data-[state=active]:bottom-0"
      >
        <div className="mx-auto max-w-7xl px-6">
          <div className="relative flex flex-wrap items-center justify-between max-lg:gap-6">
            <div className="flex w-full items-center justify-between gap-12 py-4 max-lg:in-data-[state=active]:border-b lg:w-auto lg:py-5">
              <Link
                to="/"
                aria-label="go to home"
                className="flex items-center space-x-2"
                onClick={() => setMenuState(false)}
              >
                <Logo className="size-7 text-foreground" />
                <span className="font-heading text-lg font-semibold tracking-tight">
                  Antara
                </span>
              </Link>

              <button
                onClick={() => setMenuState(!menuState)}
                aria-label={menuState == true ? "Close Menu" : "Open Menu"}
                className="relative z-20 block cursor-pointer after:absolute after:-inset-4 lg:hidden"
              >
                <div className="m-auto flex size-4.5 flex-col items-center justify-center gap-[7px] duration-200 in-data-[state=active]:scale-0 in-data-[state=active]:rotate-180 in-data-[state=active]:opacity-0">
                  <span className="h-0.5 w-full rounded-full bg-foreground" />
                  <span className="h-0.5 w-full rounded-full bg-foreground" />
                </div>

                <X className="absolute inset-0 m-auto size-6 translate-x-[-3px] scale-0 -rotate-180 opacity-0 duration-200 in-data-[state=active]:scale-100 in-data-[state=active]:rotate-0 in-data-[state=active]:opacity-100" />
              </button>

              <div className="max-lg:hidden">
                <ul className="flex gap-8 text-sm">
                  {menuItems.map((item, index) => (
                    <li key={index}>
                      <a
                        href={item.href}
                        className="block text-muted-foreground duration-150 hover:text-accent-foreground"
                      >
                        <span>{item.name}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mb-6 hidden w-full flex-wrap items-center justify-end in-data-[state=active]:block max-lg:space-y-8 md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-6 lg:in-data-[state=active]:flex">
              <div className="lg:hidden">
                <ul>
                  {menuItems.map((item, index) => (
                    <li key={index}>
                      <a
                        href={item.href}
                        onClick={() => setMenuState(false)}
                        className="block py-3 text-2xl font-medium text-foreground"
                      >
                        <span>{item.name}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex w-full flex-col space-y-3 sm:flex-row sm:gap-3 sm:space-y-0 md:w-fit">
                <Button asChild variant="outline" size="sm">
                  <Link to="/login" search={{ callbackURL: undefined }}>
                    <span>Login</span>
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/signup" search={{ callbackURL: undefined }}>
                    <span>Sign up</span>
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  )
}
