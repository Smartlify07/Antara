import { useMemo } from "react"
import { displayName } from "@/lib/person"
import type { AssignableMember } from "@/server/services/project-service"

/** Case-insensitive name/email filter over the member list. */
export function useFilteredMembers(
  members: AssignableMember[],
  query: string
): AssignableMember[] {
  return useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return members
    return members.filter((member) =>
      `${displayName(member)} ${member.email ?? ""}`
        .toLowerCase()
        .includes(needle)
    )
  }, [members, query])
}
