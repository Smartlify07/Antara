import { describe, expect, it } from "vitest"
import { isHttpUrl, isSafeReferenceLink } from "./link-schemes"
import { submitRequestSchema } from "./request-schemas"
import { submitVersionSchema } from "./version-schemas"

/**
 * These links are rendered straight into `href`, so the scheme is the security
 * boundary. `javascript:` stored once is a script that runs for every viewer.
 */
describe("link scheme allowlists", () => {
  it("accepts web and mail links", () => {
    expect(isHttpUrl("https://example.com/file.pdf")).toBe(true)
    expect(isHttpUrl("http://localhost:3000/x")).toBe(true)
    expect(isHttpUrl("HTTPS://EXAMPLE.COM")).toBe(true)
    expect(isSafeReferenceLink("mailto:ada@example.com")).toBe(true)
  })

  it("rejects executable and local schemes", () => {
    for (const value of [
      "javascript:alert(document.domain)",
      "JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
      "vbscript:msgbox(1)",
      "/relative",
      "example.com",
      "",
    ]) {
      expect(isHttpUrl(value)).toBe(false)
      expect(isSafeReferenceLink(value)).toBe(false)
    }
  })

  it("rejects javascript: in request reference links", () => {
    const base = {
      workspaceId: "w",
      title: "A request",
      brief: "A brief long enough to pass validation.",
    }
    expect(() =>
      submitRequestSchema.parse({
        ...base,
        referenceLinks: ["https://example.com/brief"],
      })
    ).not.toThrow()
    expect(() =>
      submitRequestSchema.parse({
        ...base,
        referenceLinks: ["javascript:alert(1)"],
      })
    ).toThrow()
  })

  it("rejects javascript: and data: in external version links", () => {
    const base = {
      workspaceId: "w",
      projectId: "p",
      deliverableId: "d",
      filename: "file.pdf",
      source: "external_link" as const,
    }
    expect(() =>
      submitVersionSchema.parse({
        ...base,
        url: "https://example.com/file.pdf",
      })
    ).not.toThrow()
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
    ]) {
      expect(() => submitVersionSchema.parse({ ...base, url })).toThrow()
    }
  })

  it("rejects non-http urls on uploaded versions too", () => {
    const base = {
      workspaceId: "w",
      projectId: "p",
      deliverableId: "d",
      filename: "file.pdf",
      source: "upload" as const,
      provider: "cloudinary" as const,
      providerKey: "key",
      mimeType: "application/pdf",
      sizeBytes: 10,
    }
    expect(() =>
      submitVersionSchema.parse({
        ...base,
        url: "https://res.cloudinary.com/x/file.pdf",
      })
    ).not.toThrow()
    expect(() =>
      submitVersionSchema.parse({ ...base, url: "javascript:alert(1)" })
    ).toThrow()
  })
})
