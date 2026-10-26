import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const faqItems = [
  {
    id: "item-1",
    question: "What is Antara?",
    answer:
      "Antara is a web-based platform where creative teams plan projects, assign tasks, organize multimedia assets, track file versions, and collect feedback and approvals — all in one place.",
  },
  {
    id: "item-2",
    question: "What file types can I store and review?",
    answer:
      "Antara supports videos, images, audio recordings, graphics, animations, and documents. Assets can be uploaded, organized per project, and previewed directly in the platform.",
  },
  {
    id: "item-3",
    question: "How does version tracking work?",
    answer:
      "Each time someone uploads a new version of an asset, Antara keeps the revision history. Team members can compare versions, comment on a specific version, and always see which one is the latest approved file.",
  },
  {
    id: "item-4",
    question: "Can clients review work without a full account?",
    answer:
      "Yes. You can share a project or asset with a client for review — they can view files, leave comments, and approve deliverables without needing to learn a project management tool.",
  },
  {
    id: "item-5",
    question: "How do I bring my team on board?",
    answer:
      "Invite teammates by email from your workspace settings. Roles control who can create projects, assign tasks, upload assets, and approve deliverables.",
  },
]

export default function FAQs() {
  return (
    <section id="faq" className="scroll-mt-24 py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-12 md:grid-cols-2 md:gap-6">
          <h2 className="max-w-sm text-4xl font-medium tracking-tight text-balance text-foreground">
            Frequently Asked Questions
          </h2>

          <div>
            <Accordion type="single" collapsible className="w-full">
              {faqItems.map((item) => (
                <AccordionItem
                  key={item.id}
                  value={item.id}
                  className="border-dashed"
                >
                  <AccordionTrigger className="cursor-pointer text-base hover:no-underline">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-base text-muted-foreground">
                      {item.answer}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            <p className="mt-6 text-muted-foreground">
              Can't find what you're looking for? Reach us at{" "}
              <a
                href="mailto:hello@antara.app"
                className="font-medium text-primary hover:underline"
              >
                hello@antara.app
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
