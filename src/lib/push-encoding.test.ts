import { describe, expect, it } from "vitest"
import { urlBase64ToUint8Array } from "./push-encoding"

/**
 * The VAPID public key arrives in unpadded URL-safe base64; the Push API wants
 * bytes. This pins the decoding, including the URL-safe characters that
 * standard base64 never carries.
 */

describe("urlBase64ToUint8Array", () => {
  it("decodes unpadded base64url", () => {
    // "Hello" in base64 is "SGVsbG8="; the URL-safe form drops the padding.
    expect(Array.from(urlBase64ToUint8Array("SGVsbG8"))).toEqual([
      72, 101, 108, 108, 111,
    ])
  })

  it("translates the two URL-safe characters", () => {
    // [0xfb, 0xff] → base64 "+/8=" → base64url "-_8" (unpadded).
    expect(Array.from(urlBase64ToUint8Array("-_8"))).toEqual([0xfb, 0xff])
  })

  it("round-trips a realistic VAPID public key", () => {
    const key =
      "BOeK6kVe6UGAAmIjNbXLFRg_Owff98GG_ZYYh_Nap1pXdeK6ivOu4pS_vmBizMUCzVaxKsNJlx9_UOTAMEnBCQQ"
    const bytes = urlBase64ToUint8Array(key)
    // The key is 65 bytes: a 0x04 uncompressed-point prefix plus 64 bytes.
    expect(bytes.length).toBe(65)
    expect(bytes[0]).toBe(0x04)
  })
})
