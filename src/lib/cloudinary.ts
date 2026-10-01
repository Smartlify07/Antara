const MAX_BYTES = 5 * 1024 * 1024
const MIN_DIMENSION = 200

export function validateAvatarFile(file: File): string | null {
  if (!["image/png", "image/jpeg"].includes(file.type)) {
    return "Only PNG or JPEG files are allowed."
  }
  if (file.size > MAX_BYTES) {
    return "File must be 5MB or smaller."
  }
  return null
}

export function checkAvatarDimensions(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(
        img.width >= MIN_DIMENSION && img.height >= MIN_DIMENSION
          ? null
          : "Image must be at least 200px by 200px."
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve("Could not read that image file.")
    }
    img.src = objectUrl
  })
}

/**
 * Direct browser upload to Cloudinary via an unsigned preset.
 * Requires VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.
 */
export async function uploadWorkspaceAvatar(file: File): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as
    string | undefined
  const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as
    string | undefined
  if (!cloudName || !preset) {
    throw new Error("Avatar uploads are not configured yet.")
  }
  const body = new FormData()
  body.append("file", file)
  body.append("upload_preset", preset)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body }
  )
  if (!response.ok) {
    throw new Error("Upload failed. Please try again.")
  }
  const json = (await response.json()) as { secure_url?: string }
  if (!json.secure_url) {
    throw new Error("Upload failed. Please try again.")
  }
  return json.secure_url
}
