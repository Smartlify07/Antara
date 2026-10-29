/**
 * Base64url decoding for the VAPID public key, used on the client to build the
 * `applicationServerKey` for `pushManager.subscribe()`.
 *
 * The key arrives from `import.meta.env.VITE_VAPID_PUBLIC_KEY` in unpadded
 * URL-safe base64 (what `web-push generate-vapid-keys` emits). The Push API
 * expects the key as an `ArrayBufferSource`, so it must be decoded to bytes
 * first. `atob` only understands standard base64, hence the translation of the
 * two URL-safe characters and the re-padding first.
 */

export function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
