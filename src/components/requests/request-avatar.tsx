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
 * The requester's avatar — one component so the card and the dialog can
 * never drift apart: the shadcn Avatar with the per-person tint the team
 * page assigns (seeded by the requester's user id, name as fallback).
 * Always decorative; the accompanying name text is always rendered next
 * to it in whatever surface places it.
 */
export function RequesterAvatar({
  userId,
  name,
  image,
}: {
  userId: string | null
  name: string | null
  image: string | null
}) {
  return (
    <Avatar size="sm" aria-hidden>
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback
        className={`text-[10px] font-medium ${avatarTint(userId ?? name ?? "former-member")}`}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
