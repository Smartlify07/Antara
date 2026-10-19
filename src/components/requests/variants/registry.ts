/**
 * The request-card variation registry. Each entry is a lane: a variant owns
 * exactly its folder under `variants/<id>/` and renders the whole card —
 * gradient artwork, white text, metadata — against the shared contract:
 *
 * - Grid slots are 1–4 columns wide (the page owns layout, not the card).
 * - The gradient covers the card full-height like artwork; all text sits on
 *   it and must be the white tokens from `card-gradient.ts` (or equally
 *   legible).
 * - Clicking anything that isn't an explicit external link (e.g. the linked
 *   project chip) opens the detail dialog via `onOpen` — never a route
 *   change.
 */
import type { ComponentType } from "react"
import type { RequestListItem } from "@/server/services/request-service"
import { RequestCard as AuroraCard } from "./aurora/request-card"
import { RequestCard as DuotoneCard } from "./duotone/request-card"
import { RequestCard as SpotlightCard } from "./spotlight/request-card"

export type RequestCardProps = {
  workspaceSlug: string
  request: RequestListItem
  /** Open the Linear-style detail dialog for this request. */
  onOpen: (requestId: string) => void
}

export type RequestVariant = {
  label: string
  Card: ComponentType<RequestCardProps>
}

export const REQUEST_VARIANTS: Record<string, RequestVariant> = {
  aurora: { label: "Aurora", Card: AuroraCard },
  duotone: { label: "Duotone", Card: DuotoneCard },
  spotlight: { label: "Spotlight", Card: SpotlightCard },
}

export const REQUEST_VARIANT_IDS = Object.keys(REQUEST_VARIANTS)
export const DEFAULT_REQUEST_VARIANT = "aurora"
