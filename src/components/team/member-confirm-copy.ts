export interface MemberConfirmCopy {
  title: (name: string) => string
  description: string
  confirmLabel: string
  pendingLabel: string
  destructive: boolean
}

/**
 * Copy for the member actions that change access. Kept out of the row
 * component so the sentences are reviewed in one place.
 */
export const MEMBER_CONFIRM_COPY = {
  remove: {
    title: (name: string) => `Remove ${name}?`,
    description:
      "They lose access to this workspace immediately. Their projects, tasks, and versions stay, credited to them.",
    confirmLabel: "Remove",
    pendingLabel: "Removing…",
    destructive: true,
  },
  suspend: {
    title: (name: string) => `Suspend ${name}?`,
    description:
      "Their access stops immediately and stays paused until an admin unsuspends them. Their seat, role and history are kept.",
    confirmLabel: "Suspend",
    pendingLabel: "Suspending…",
    destructive: false,
  },
} satisfies Record<string, MemberConfirmCopy>
