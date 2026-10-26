import { CloudUpload, GitBranch, Layers, ShieldCheck } from "lucide-react"

const pillars = [
  {
    icon: CloudUpload,
    title: "Centralized assets.",
    body: "Upload, organize, and find every video, photo, audio file, and document in one library.",
  },
  {
    icon: GitBranch,
    title: "Version control.",
    body: "Every revision is tracked, so the team always works from the latest approved file.",
  },
  {
    icon: Layers,
    title: "Structured projects.",
    body: "Break work into tasks, assign owners, set priorities, and monitor progress in real time.",
  },
  {
    icon: ShieldCheck,
    title: "Approvals that stick.",
    body: "Clients review and sign off inside the platform, with a record of every decision.",
  },
]

export default function ContentSection() {
  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-4 md:grid-cols-2 md:gap-6 lg:gap-12">
          <h2 className="max-w-md text-4xl font-medium tracking-tight text-balance lg:text-5xl">
            A single platform for the whole production process.
          </h2>
          <div className="space-y-6 lg:space-y-12">
            <p className="text-lg text-balance text-muted-foreground">
              Antara brings planning, task management, asset organization,
              version tracking, and approvals together — so creative teams stop
              stitching the workflow together from chat apps, drives, and
              spreadsheets.
            </p>

            <div className="grid gap-6 pt-6 sm:grid-cols-2">
              {pillars.map((pillar) => (
                <p
                  key={pillar.title}
                  className="text-lg text-balance text-muted-foreground"
                >
                  <span className="font-medium text-foreground">
                    <pillar.icon className="inline size-4 -translate-y-0.5" />{" "}
                    {pillar.title}
                  </span>{" "}
                  {pillar.body}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
