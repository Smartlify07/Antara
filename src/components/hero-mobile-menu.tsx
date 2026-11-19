import { Link } from "@tanstack/react-router"

const links = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
]

/** Full-screen sheet under the notch. The notch itself stays on top and its
 *  button becomes the close control, so there is only ever one X on screen. */
export function HeroMobileMenu({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div
      id="hero-mobile-menu"
      className="animate-in fade-in slide-in-from-top-2 fixed inset-0 z-40 flex flex-col justify-between bg-[#0a0a0a] px-7 pt-28 pb-10 text-white duration-200 md:hidden"
    >
      <ul>
        {links.map((item) => (
          <li key={item.label}>
            <a
              href={item.href}
              onClick={onNavigate}
              className="block py-2.5 text-[2rem] font-medium tracking-[-0.03em] text-white/85 transition-colors hover:text-white"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        <Link
          to="/signup"
          search={{ callbackURL: undefined }}
          className="flex h-12 items-center justify-center rounded-full bg-white text-[15px] font-medium text-[#0a0a0a]"
        >
          Sign up
        </Link>
        <Link
          to="/login"
          search={{ callbackURL: undefined }}
          className="flex h-12 items-center justify-center rounded-full text-[15px] text-white/65"
        >
          Log in
        </Link>
      </div>
    </div>
  )
}
