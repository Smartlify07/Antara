"use client"

import { CheckIcon } from "lucide-react"
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * Workspace-scope roles only. Project-scope `lead`/`member` share these titles,
 * so the server resolves the title against scope; this list only decides what
 * the menu offers.
 */
const MEMBER_ROLES = ["member", "admin"] as const

function label(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export function ChangeRoleMenu({
  currentRole,
  pending,
  onPick,
}: {
  currentRole: string
  pending: boolean
  onPick: (roleTitle: string) => void
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={pending}>
        Change role
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {MEMBER_ROLES.map((role) => (
          <DropdownMenuItem
            key={role}
            // The current role is disabled rather than hidden: the check mark
            // answers "what are they now?" and a missing row would not.
            disabled={role === currentRole || pending}
            onSelect={() => onPick(role)}
          >
            {role === currentRole && <CheckIcon />}
            {label(role)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
