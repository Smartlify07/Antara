import { afterEach, describe, expect, it } from "vitest"
import { appOrigin } from "./app-origin"

/** `appOrigin` reads process.env directly; each case owns its environment. */
const MANAGED = [
  "NODE_ENV",
  "APP_URL",
  "BETTER_AUTH_URL",
  "VERCEL_ENV",
  "VERCEL_URL",
] as const
const saved = Object.fromEntries(MANAGED.map((key) => [key, process.env[key]]))

function setEnv(values: Partial<Record<(typeof MANAGED)[number], string>>) {
  for (const key of MANAGED) delete process.env[key]
  Object.assign(process.env, values)
}

afterEach(() => {
  for (const key of MANAGED) {
    const value = saved[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe("appOrigin", () => {
  it("prefers APP_URL and strips trailing slashes", () => {
    setEnv({ NODE_ENV: "production", APP_URL: "https://antara.test/" })
    expect(appOrigin()).toBe("https://antara.test")
  })

  it("falls back to BETTER_AUTH_URL", () => {
    setEnv({ NODE_ENV: "production", BETTER_AUTH_URL: "https://auth.test" })
    expect(appOrigin()).toBe("https://auth.test")
  })

  it("uses the deployment host on preview deployments", () => {
    setEnv({
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      VERCEL_URL: "antara-git-fix-authz.vercel.app",
    })
    expect(appOrigin()).toBe("https://antara-git-fix-authz.vercel.app")
  })

  it("does not use VERCEL_URL as a production fallback", () => {
    setEnv({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      VERCEL_URL: "antara-abc.vercel.app",
    })
    expect(() => appOrigin()).toThrow(/neither APP_URL nor BETTER_AUTH_URL/)
  })

  it("returns the dev origin outside production", () => {
    setEnv({ NODE_ENV: "development" })
    expect(appOrigin()).toBe("http://localhost:3000")
  })
})
