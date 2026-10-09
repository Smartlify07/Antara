import { useSyncExternalStore } from "react"
import type { ProjectStatus } from "@/db/enums"
import { slugifyTitle } from "@/lib/project-schemas"
import type {
  ProjectListItem,
  ProjectTagOption,
} from "@/server/services/project-service"

/**
 * Optimistically-added projects.
 *
 * Project creation writes to the server through a server function, so there
 * is no query cache to patch. This store stands in for one: the new project
 * appears immediately, survives the navigation to the projects list, and is
 * dropped on rollback (failure) or once the real row arrives (success).
 *
 * Kept in a module rather than component state so it survives the route
 * change between the create form and the list.
 */

export interface OptimisticProject extends ProjectListItem {
  /** True until the server confirms or rejects the write. */
  optimistic: boolean
}

interface State {
  projects: OptimisticProject[]
  error: string | null
}

let state: State = { projects: [], error: null }
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function snapshot() {
  return state
}

export function addOptimisticProject(project: OptimisticProject) {
  state = {
    ...state,
    projects: [...state.projects, project],
    error: null,
  }
  emit()
}

/** Rollback, and reconciliation once the server row is in the list. */
export function clearOptimisticProject(id: string) {
  if (!state.projects.some((project) => project.id === id)) return
  state = {
    ...state,
    projects: state.projects.filter((project) => project.id !== id),
  }
  emit()
}

export function setOptimisticError(error: string | null) {
  state = { ...state, error }
  emit()
}

function makeId() {
  return `optimistic-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`
}

/** Builds the placeholder row rendered before the server responds. */
export function buildOptimisticProject(input: {
  title: string
  description: string
  status: ProjectStatus
  startDate: Date | null
  deadline: Date | null
  memberCount: number
  tags: ProjectTagOption[]
}): OptimisticProject {
  return {
    id: makeId(),
    title: input.title,
    slug: slugifyTitle(input.title),
    description: input.description || null,
    status: input.status,
    startDate: input.startDate,
    deadline: input.deadline,
    createdAt: new Date(),
    gradientStart: null,
    gradientEnd: null,
    taskCount: 0,
    memberCount: input.memberCount,
    commentCount: 0,
    tags: input.tags,
    optimistic: true,
  }
}

export function useOptimisticProjects() {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
