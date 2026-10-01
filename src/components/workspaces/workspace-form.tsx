import { Link, useNavigate } from "@tanstack/react-router"
import { zodResolver } from "@hookform/resolvers/zod"
import { Check, ImagePlus, Loader2, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  checkAvatarDimensions,
  uploadWorkspaceAvatar,
  validateAvatarFile,
} from "@/lib/cloudinary"
import {
  slugifyName,
  workspaceSchema,
  type WorkspaceInput,
} from "@/lib/workspace-schemas"
import { checkSlugFn, createWorkspaceFn } from "@/server/functions/workspaces"
import { cn } from "@/lib/utils"

type SlugState = "idle" | "checking" | "available" | "taken"

function AvatarPreview({
  name,
  previewUrl,
}: {
  name: string
  previewUrl: string | null
}) {
  if (previewUrl) {
    return (
      <img
        src={previewUrl}
        alt="Workspace logo preview"
        className="size-12 rounded-xl object-cover ring-1 ring-black/10 ring-inset"
      />
    )
  }
  const initial = (name.trim()[0] ?? "W").toUpperCase()
  return (
    <span
      aria-hidden
      className="flex size-12 items-center justify-center rounded-xl bg-muted text-lg font-medium text-muted-foreground ring-1 ring-black/5 ring-inset"
    >
      {initial}
    </span>
  )
}

export function WorkspaceForm() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [slugTouched, setSlugTouched] = useState(false)
  const [slugState, setSlugState] = useState<SlugState>("idle")

  const form = useForm<WorkspaceInput>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: { name: "", slug: "" },
  })

  const name = form.watch("name")
  const slug = form.watch("slug")

  // Derive the handle from the name until the user edits it directly.
  useEffect(() => {
    if (!slugTouched) {
      form.setValue("slug", slugifyName(name), { shouldValidate: false })
    }
  }, [name, slugTouched, form])

  // Debounced availability check against the owner's namespace.
  useEffect(() => {
    if (!slug || form.formState.errors.slug) {
      setSlugState("idle")
      return
    }
    setSlugState("checking")
    const id = setTimeout(async () => {
      try {
        const available = await checkSlugFn({ data: { slug } })
        setSlugState(available ? "available" : "taken")
      } catch {
        setSlugState("idle")
      }
    }, 400)
    return () => clearTimeout(id)
  }, [slug, form])

  useEffect(() => {
    if (!avatarFile) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(avatarFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [avatarFile])

  function handleFileSelect(file: File | undefined) {
    if (!file) return
    const invalid = validateAvatarFile(file)
    if (invalid) {
      setAvatarError(invalid)
      return
    }
    setAvatarError(null)
    setAvatarFile(file)
  }

  function clearAvatar() {
    setAvatarFile(null)
    setAvatarError(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  async function onSubmit(values: WorkspaceInput) {
    setServerError(null)
    try {
      let avatarUrl: string | null = null
      if (avatarFile) {
        const dimsError = await checkAvatarDimensions(avatarFile)
        if (dimsError) {
          setAvatarError(dimsError)
          return
        }
        avatarUrl = await uploadWorkspaceAvatar(avatarFile)
      }
      const workspace = await createWorkspaceFn({
        data: { name: values.name, slug: values.slug, avatarUrl },
      })
      await navigate({
        to: "/w/$workspaceSlug",
        params: { workspaceSlug: workspace.slug },
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong."
      if (message.toLowerCase().includes("taken")) {
        form.setError("slug", { message })
        setSlugState("taken")
        return
      }
      setServerError(message)
    }
  }

  const { errors, isSubmitting } = form.formState

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-6"
      noValidate
    >
      <FieldGroup>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-medium tracking-tighter">
            Create your workspace
          </h1>
          <p className="text-sm tracking-tight text-muted-foreground">
            Your projects, team, and assets will live here.
          </p>
        </div>

        {serverError && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {serverError}
          </p>
        )}

        <Field>
          <FieldLabel>Workspace logo</FieldLabel>
          <div className="flex items-center gap-3">
            <AvatarPreview name={name} previewUrl={previewUrl} />
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              aria-label="Upload workspace logo"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus />
              Upload image
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!avatarFile}
              onClick={clearAvatar}
            >
              Remove
            </Button>
          </div>
          <FieldDescription>
            *.png, *.jpeg files up to 5MB, at least 200px by 200px.
          </FieldDescription>
          {avatarError && (
            <p role="alert" className="text-sm text-destructive">
              {avatarError}
            </p>
          )}
        </Field>

        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="workspace-name">Workspace name</FieldLabel>
          <Input
            id="workspace-name"
            type="text"
            placeholder="Enter a workspace name"
            autoComplete="organization"
            aria-invalid={!!errors.name}
            {...form.register("name")}
          />
          <FieldError errors={[errors.name]} />
        </Field>

        <Field data-invalid={!!errors.slug || slugState === "taken"}>
          <FieldLabel htmlFor="workspace-slug">Workspace handle</FieldLabel>
          <div className="flex items-stretch gap-0">
            <span
              aria-hidden
              className="flex items-center rounded-l-lg border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground"
            >
              /w/
            </span>
            <div className="relative flex-1">
              <Input
                id="workspace-slug"
                type="text"
                placeholder="my-workspace"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={!!errors.slug || slugState === "taken"}
                className="rounded-l-none pr-9"
                {...form.register("slug", {
                  onChange: () => setSlugTouched(true),
                })}
              />
              <span className="absolute top-1/2 right-3 -translate-y-1/2">
                {slugState === "checking" && (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                )}
                {slugState === "available" && (
                  <Check className="size-4 text-emerald-600" />
                )}
                {slugState === "taken" && (
                  <X className="size-4 text-destructive" />
                )}
              </span>
            </div>
          </div>
          <FieldError errors={[errors.slug]} />
          {!errors.slug && slugState === "taken" && (
            <p role="alert" className="text-sm text-destructive">
              That handle is already taken.
            </p>
          )}
          {!errors.slug && slugState !== "taken" && (
            <FieldDescription>
              Lowercase letters, numbers, and hyphens. Never changes.
            </FieldDescription>
          )}
        </Field>

        <Field>
          <Button
            type="submit"
            disabled={isSubmitting}
            className={cn("w-full")}
          >
            {isSubmitting && <Loader2 className="animate-spin" />}
            {isSubmitting ? "Creating workspace…" : "Continue"}
          </Button>
          <FieldDescription className="px-6 text-center">
            Not now?{" "}
            <Link to="/dashboard" className="font-medium">
              Skip for later
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
