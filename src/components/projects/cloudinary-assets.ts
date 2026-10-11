const MAX_BYTES = 100 * 1024 * 1024

/**
 * Cloudinary resource type per upload. `/image/upload` only accepts images, so
 * anything else has to go to its own endpoint — sending a PDF to the image
 * endpoint returns 400.
 */
const RESOURCE_TYPES: Record<string, string> = {
  image: "image",
  video: "video",
  audio: "audio",
}

export interface UploadedAsset {
  url: string
  providerKey: string
  mimeType: string
  sizeBytes: number
}

export function validateAssetFile(file: File): string | null {
  if (file.size === 0) return `${file.name} is empty.`
  if (file.size > MAX_BYTES) {
    return `${file.name} is larger than 100MB.`
  }
  return null
}

/**
 * Uploads one file directly to Cloudinary through the unsigned preset.
 *
 * This is the same approach as `uploadWorkspaceAvatar`, widened beyond images:
 * no server round trip, so a 90MB video never occupies a request handler on
 * Vercel. The preset must permit the `video`, `audio` and `raw` resource types
 * and the relevant formats — an unsigned preset that only allows images will
 * reject everything else with a 400 from Cloudinary.
 */
export async function uploadAsset(file: File): Promise<UploadedAsset> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as
    string | undefined
  const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as
    string | undefined
  if (!cloudName || !preset) {
    throw new Error("File uploads are not configured yet.")
  }

  const resourceType = RESOURCE_TYPES[file.type.split("/")[0] ?? ""] ?? "raw"

  const body = new FormData()
  body.append("file", file)
  body.append("upload_preset", preset)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    { method: "POST", body }
  )
  if (!response.ok) {
    throw new Error(`Could not upload ${file.name}.`)
  }

  const json = (await response.json()) as {
    secure_url?: string
    public_id?: string
    resource_type?: string
    type?: string
    bytes?: number
  }
  if (!json.secure_url || !json.public_id) {
    throw new Error(`Could not upload ${file.name}.`)
  }

  return {
    url: json.secure_url,
    // The deletion worker needs the provider-side key, which is the public_id
    // qualified by resource type and delivery type — a bare public_id would
    // not address the right file.
    providerKey: `${json.resource_type ?? resourceType}/${json.type ?? "upload"}/${json.public_id}`,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: json.bytes ?? file.size,
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
