import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { avatarTint } from "@/lib/avatar-tint"

function initials(name: string | null): string {
  return (
    name
      ?.split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  )
}

/**
 * A person's avatar — one component so the card, the dialog and the thread
 * can never drift apart: the shadcn Avatar with the per-person tint the team
 * page assigns (seeded by the user's id, name as fallback). Always
 * decorative; the accompanying name text is rendered next to it in whatever
 * surface places it. `className` is for row-positioning niceties (margins,
 * flex behaviour) only — the footprint stays the `sm` preset, whose
 * `data-[size=sm]` sizing intentionally wins over plain size utilities.
 */
export function RequesterAvatar({
  userId,
  name,
  image,
  className,
}: {
  userId: string | null
  name: string | null
  image: string | null
  className?: string
}) {
  return (
    <Avatar size="sm" aria-hidden className={className}>
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback
        className={`text-[10px] font-medium ${avatarTint(userId ?? name ?? "former-member")}`}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
