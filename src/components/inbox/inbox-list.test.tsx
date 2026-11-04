// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { InboxList } from "./inbox-list"
import type { InboxController } from "./use-inbox"
import type { NotificationItem } from "@/server/services/notification-service"

// The sentinel is in view for every test, so mounting the list is enough to
// exercise the infinite-scroll wiring.
vi.mock("framer-motion", () => ({ useInView: () => true }))

afterEach(cleanup)

function item(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "n1",
    type: "task_assigned",
    subjectType: "task",
    subjectId: "task-1",
    message: "Ada assigned Logo exploration to you",
    messageParts: [
      { text: "Ada", actor: true },
      { text: " assigned Logo exploration to you" },
    ],
    actor: { id: "u1", name: "Ada", email: null, image: null },
    projectSlug: "brand-refresh",
    deliverableId: null,
    subjectLabel: "Logo exploration",
    readAt: null,
    createdAt: new Date("2026-11-01T10:00:00.000Z"),
    ...overrides,
  }
}

function controller(overrides: Partial<InboxController> = {}): InboxController {
  return {
    items: [item()],
    isPending: false,
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    unreadCount: 1,
    markAllRead: { isPending: false, mutate: vi.fn() },
    markRead: { mutate: vi.fn() },
    open: vi.fn(),
    ...overrides,
  } as unknown as InboxController
}

describe("InboxList", () => {
  it("renders rows and opens the row's exact destination", () => {
    const inbox = controller()
    render(<InboxList inbox={inbox} />)

    const message = screen.getByText("assigned Logo exploration to you")
    fireEvent.click(message.closest("button") as HTMLButtonElement)

    expect(inbox.open).toHaveBeenCalledWith(inbox.items[0])
  })

  it("marks a row read without navigating", () => {
    const inbox = controller()
    render(<InboxList inbox={inbox} />)

    fireEvent.click(screen.getByRole("button", { name: "Mark read" }))

    expect(inbox.markRead.mutate).toHaveBeenCalledWith("n1")
    expect(inbox.open).not.toHaveBeenCalled()
  })

  it("asks for the next page when the sentinel is reached", () => {
    const inbox = controller({ hasNextPage: true })
    render(<InboxList inbox={inbox} />)

    expect(inbox.fetchNextPage).toHaveBeenCalled()
  })

  it("shows the honest empty state instead of an empty list", () => {
    render(<InboxList inbox={controller({ items: [] })} />)

    expect(screen.getByText("All caught up")).toBeTruthy()
  })
})
