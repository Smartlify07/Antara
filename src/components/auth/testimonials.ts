export interface Testimonial {
  quote: string
  name: string
  role: string
  studio: string
  initials: string
}

export const testimonials: Testimonial[] = [
  {
    quote:
      "Antara killed our tool sprawl. Briefs, assets, tasks, and client approvals finally live in one place — we stopped losing files in chat threads.",
    name: "Maya Okafor",
    role: "Founder & Creative Director",
    studio: "Studio North",
    initials: "MO",
  },
  {
    quote:
      "We went from three platforms to one. Assigning work against the actual assets changed how fast our motion team ships.",
    name: "Daniel Reyes",
    role: "Head of Production",
    studio: "Framehouse Collective",
    initials: "DR",
  },
  {
    quote:
      "Client reviews used to take a week of follow-ups. Now feedback lands on the task next to the file, and approvals take an afternoon.",
    name: "Priya Nair",
    role: "Account Director",
    studio: "Brightline Media",
    initials: "PN",
  },
  {
    quote:
      "Onboarding freelancers is trivial now — invite them to the project and everything they need is already there. No more access-request ping-pong.",
    name: "Tom Bakker",
    role: "Managing Partner",
    studio: "Loop & Co.",
    initials: "TB",
  },
]
