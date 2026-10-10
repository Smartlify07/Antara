import { text } from "drizzle-orm/pg-core"

/**
 * A random v4 UUID, generated without `node:crypto`.
 *
 * This file sits under the schema, which is imported by `@/db`, which
 * `auth.ts` imports, which every server-function module imports — and route
 * files import those. A `node:crypto` import here therefore risks landing in
 * the client graph, where Vite externalises it and the runtime throws at module
 * init. That kills hydration, and a dead page looks nothing like a build error:
 * forms silently fall back to native GET submits.
 *
 * `crypto.randomUUID` is used where available (browsers in secure contexts,
 * Node 19+), with a `getRandomValues` fallback so the schema is never the
 * reason a bundle breaks.
 */
function uuid(): string {
  const webcrypto = globalThis.crypto
  if (typeof webcrypto?.randomUUID === "function") return webcrypto.randomUUID()

  const bytes = new Uint8Array(16)
  webcrypto.getRandomValues(bytes)
  // Version 4, variant 1 — same layout randomUUID produces.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20
  )}-${hex.slice(20)}`
}

export const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => uuid())
