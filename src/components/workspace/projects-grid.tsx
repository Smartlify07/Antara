import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import type { ProjectListItem } from "@/server/services/project-service"
import type { OptimisticProject } from "@/lib/optimistic-projects"
import { ProjectCard } from "@/components/workspace/project-card"

/**
 * Project grid with an entrance animation. Cards still awaiting the server
 * render with reduced emphasis; when the real row arrives it replaces the
 * placeholder in place via `layout`.
 */
export function ProjectsGrid({
  projects,
  workspaceId,
  canManage,
}: {
  projects: (ProjectListItem | OptimisticProject)[]
  workspaceId: string
  canManage: boolean
}) {
  const reduceMotion = useReducedMotion()

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <AnimatePresence initial={false} mode="popLayout">
        {projects.map((project) => (
          <motion.div
            key={project.id}
            layout={reduceMotion ? false : "position"}
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }
            }
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <ProjectCard
              project={project}
              workspaceId={workspaceId}
              canManage={canManage}
              optimistic={"optimistic" in project ? project.optimistic : false}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
