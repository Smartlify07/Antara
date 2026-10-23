import type { LibraryAssetSummary } from "@/server/services/library-service"

/**
 * The folder wall's view model: the library's assets folded into their
 * projects — a folder is a project (the cutout's title is the project name).
 * Pure and component-free so the fold is assertable by a test; everything
 * the folders look like is presentation and lives beside the components.
 *
 * Ordering: folders follow the projects list (the Work tab's own order), so
 * the wall and the projects page read as one surface. Assets keep the list
 * order they arrive in — most recently touched first — which is what the
 * pocket strips peek. Projects the search or workspace has no live list row
 * for still keep their books: an asset's project is not allowed to vanish
 * from the wall while its files remain.
 */

export interface LibraryFolderProject {
  id: string
  title: string
  slug: string
  gradientStart: string | null
  gradientEnd: string | null
}

export interface LibraryFolder extends LibraryFolderProject {
  assets: LibraryAssetSummary[]
  /** The folder's newest touch, for the cutout's meta line; null when empty. */
  lastActivity: Date | null
}

function latestOf(a: Date, b: Date): Date {
  return b.getTime() > a.getTime() ? b : a
}

/**
 * An asset's last touch: its newest version's creation when it has one, the
 * file's own creation otherwise — the same "recently touched" sense the
 * list orders by.
 */
function assetTouchedAt(asset: LibraryAssetSummary): Date {
  return asset.latestVersion?.createdAt ?? asset.createdAt
}

export function groupAssetsIntoFolders(
  assets: LibraryAssetSummary[],
  projects: LibraryFolderProject[]
): LibraryFolder[] {
  const folders = new Map<string, LibraryFolder>()
  for (const project of projects) {
    folders.set(project.id, { ...project, assets: [], lastActivity: null })
  }
  for (const asset of assets) {
    const folder = folders.get(asset.projectId)
    const touched = assetTouchedAt(asset)
    if (folder) {
      folder.assets.push(asset)
      folder.lastActivity = folder.lastActivity
        ? latestOf(folder.lastActivity, touched)
        : touched
    } else {
      // A book whose shelf has no listed project yet (the projects fetch is
      // still behind the assets', or the project row vanished): surface it
      // rather than drop it, palette-less until the list resolves.
      folders.set(asset.projectId, {
        id: asset.projectId,
        title: asset.projectTitle,
        slug: asset.projectSlug,
        gradientStart: null,
        gradientEnd: null,
        assets: [asset],
        lastActivity: touched,
      })
    }
  }
  return [...folders.values()]
}
