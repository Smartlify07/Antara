# Antara — a full workflow example

One piece of work followed end to end through the product: a request comes in,
grows into a project, and a video gets reviewed and approved. Every step is
built and wire-navigable today. Route paths and status labels are the real
ones from the code; §8 lists the few things that are deliberately not wired yet.

---

## 1. The cast

| Person | Workspace role        | What they do in this story                                                       |
| ------ | --------------------- | -------------------------------------------------------------------------------- |
| Priya  | Owner / admin         | Creates the workspace, invites the team, triages, decides on versions            |
| Dolapo | Member · project lead | Leads the Aurora Launch project, shapes deliverables and tasks, submits versions |
| Ada    | Member (invitee)      | Video editor — owns a deliverable, works tasks, submits versions                 |
| Tayo   | Member (invitee)      | Designer — works tasks under a deliverable                                       |

All four are workspace members. A project _lead_ is a project-level role, set
when the project is created or accepted — it is not a workspace role, and
roles can't be changed today (§8). Triage belongs to the workspace owner or
an admin/lead; today that means Priya. Antara has no client portal: if a
client submits work, it arrives as a request like anyone else's.

---

## 2. Get in: sign up, verify, set up the workspace

1. **Priya signs up** — `/signup`, email + password (or Google). Email
   verification is required, so the form answers with "check your inbox".
2. **She verifies** — clicks the emailed link. That runs the verification,
   signs her in, and redirects to `/verify-email`, a status page (success or
   `?error=TOKEN_EXPIRED`). If the 48-hour link expired, the resend form there
   is the recovery path.
3. **She creates the workspace** — `/dashboard` has no content; it redirects
   an account with no workspaces to `/workspaces/new`. Priya creates **Kite
   Studio** with handle `kite` and an avatar. `/w/kite` now works; bare
   `/w/kite` redirects to `/w/kite/projects`.
4. **She invites the team** — Priya opens **Team**, uses the Invite dialog
   with a comma-separated list (max 20): Dolapo, Ada, Tayo. Each address
   either sends or fails with a visible reason; failed ones stay in the box
   for retry. Reserved **Awaiting** rows appear immediately. Emails go out
   via Resend with a `/invite/<token>` link.
5. **Dolapo and Ada accept** — each clicks their link; an unverified account
   runs the verification flow first, then Accepts from the consent screen.
   They enter as `member`. Anyone who lost the link finds it again at
   `/invite/pending`,
   which also works when an invite was claimed against a _not yet registered_
   address — the pending seat backfills once that email verifies.
6. The bell in the header is the notification surface. Nothing exists yet for
   anyone, so it's quiet. The team page shows everyone; there are no role
   changes yet (§8).

---

## 3. Intake: a request arrives and is triaged

7. **Submit** — Dolapo opens **Requests** → _New request_:
   - Title: "15s Aurora launch film"
   - Brief (≥20 chars): what the film must show, tone, where it runs
   - Category: "Video" (suggestions come from previously used categories)
   - Priority: high, desired deadline: Nov 7, reference links: the brand deck
8. It lands as `open` and he's taken to
   `/w/kite/requests/<id>`. Any member can post on the brief thread.
9. **Triage** — owner/admins/leads only; the triage bar exists only while the
   status is `open` or `needs_info`, so Priya is the one who sees it. Note the
   sidebar's Requests badge (open + needs_info count) is visible only to
   triagers too.
   - Priya can't tell the aspect ratio from the brief. **Ask for info** with a
     message → status `needs_info`, her message posts to the thread. Dolapo
     replies: "9:16 and 1:1 crops by launch day."
   - Priya hits **Accept**. The dialog has two modes:
     - _New project_ — title, description, status, lead, members, tags,
       start/deadline. She creates **Aurora Launch**, lead Dolapo, with Ada and
       Tayo as members.
     - _Existing project_ — a searchable picker.
   - She accepts into the new project. The request now carries a
     "→ Aurora Launch" chip; a comment on the request records the decision.
     `accepted` is terminal — there is no reopening, in either direction.
   - If two people triage at once, the second one is told it was "just triaged
     by someone else" instead of silently overwriting.

---

## 4. Shape the work: deliverables and tasks

10. **Plan it** — Dolapo opens the project
    `/w/kite/projects/aurora-launch`. **Overview** holds the tags, the
    description and the properties panel; the _Invite member_ dialog on this
    page adds a project-level member (the workspace invite in step 4 doesn't
    put anyone _in_ projects).
11. **Work tab — deliverables.** He adds two:
    - _Launch film 15s_ — owner Ada, type video, deadline Nov 3
    - _Poster set_ — owner Tayo
      A new deliverable starts as `planned`. The status chip's menu offers only
      the machine's legal moves; `completed` is terminal.
12. **Task composer.** Under the film deliverable: "Cut the first edit" →
    Ada, priority high, due Oct 28. The assignment fires a notification into
    Ada's bell ("Dolapo assigned _Cut the first edit_ to you"); Dolapo, who
    performed it, gets nothing — the actor is never notified about their own
    action.

---

## 5. Produce, review, decide, revise — the version loop

13. **Work the tasks.** Ada lives in **My tasks** (badge = open tasks assigned
    to her, soonest deadline first, overdue marked, `?task=` deep-links in
    straight from the bell and highlight for 4 seconds). She moves
    `todo → in_progress → done` from the row. Any non-no-op status move is
    legal and each move is recorded in status history.
14. **First cut.** Dolapo moves the deliverable chip to `in_progress`. Ada
    opens the deliverable card, _New version_:
    - **Link** — a URL to the file wherever it lives. The form says plainly:
      "Antara cannot detect changes to a linked file."
    - **Upload** — direct file, if Cloudinary is configured on the server.
    - Version label (defaults to `v<n>`) and optional "What changed" notes.
15. **Send for review** — the version starts as a draft with review status
    `null`. She hits _Send for review_ → `submitted`; Priya's and Dolapo's
    bells show "… is waiting for review". Dolapo moves the deliverable chip to
    `ready_for_review`.
16. **Locate the review.** Priya's sidebar shows **Reviews** with a badge. The
    queue lists every submitted version she may decide in, stalest submission
    first. The queue itself is navigational — the row's action is _Open
    project_, which lands her on the deliverable card with the version in
    question.
17. **Feedback, then a decision.** She reads the v1, posts on the version's
    thread ("cut lands before the logo settles") — Ada gets it as
    `version_feedback`. Then **Decide…** → _Request changes_ with an optional
    comment → `changes_requested`; Ada's bell tells her.
18. **Revise.** Ada uploads v2. v1 automatically becomes `superseded` — the
    machine assigns it, it can no longer be decided, and it stays in the
    timeline. She sends v2 for review.
19. **Approve.** Priya opens v2, **Decide…** → _Approve_ → `approved`. The
    decision is written to an append-only approvals record (who, what, when,
    optional comment). Ada's bell confirms. A `rejected` decision works the
    same way; submitting the next version supersedes it rather than reopening
    it.

---

## 6. The record: library, activities, completion

20. **Library is the ask-me-anything surface.** `/w/kite/library` lists every
    asset with search and filters (type, project, deliverable, state). The
    asset detail page shows the full version timeline — uploaders, timestamps,
    _Latest_ / _Latest approved_ flags, review-status chips, submitter notes,
    and the decision history. It is **read-only by design**: "this page is
    where questions are answered, not where the workflow happens."
21. **Activities tab** carries the project's update feed — the audit surface
    for who did what, including versioned attachments.
22. **Close it out.** Dolapo flips the deliverable chip to `completed`
    (terminal). Priya sets the project status pill to `completed`. The request
    that started it stays linked. Ada's answer to "which cut shipped?" is one
    Library row: _Latest approved → v2, approved by Priya, Oct 30_.

---

## 7. Status vocabulary

One glance at every state machine in the product:

| Thing          | States                                                                                                                       | Notes                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Request triage | `open` → `needs_info` → `accepted` / `declined`                                                                              | Needs-info can go back to `open`; accepted/declined are terminal. Late triager gets an explicit error. |
| Project        | `planning`, `active`, `on_hold`, `completed`, `archived`                                                                     | Set on create, editable later.                                                                         |
| Deliverable    | `planned`, `in_progress`, `blocked`, `ready_for_review`, `changes_requested`, `completed`                                    | Menu offers legal moves only; `completed` terminal.                                                    |
| Task           | `backlog`, `todo`, `in_progress`, `done`, `approved`                                                                         | Any non-no-op move is legal; moves hit status history.                                                 |
| Version review | draft (`null`) → `submitted` → `approved` / `rejected` / `changes_requested`; `superseded` when a newer version is submitted | Superseded is machine-assigned and undecidable; decisions are re-openable from the failure states.     |

---

## 8. What this walkthrough does not cover, on purpose

Six honest limits of the current build:

- **Team role changes, suspension, removal.** The Team page says so outright;
  the only admin action today is revoking a pending invite. Invites always
  create `member` — granting admin isn't offered from there.
- **The Reviews queue as a decision surface.** It routes you to the version
  row; approve/decide happens there.
- **Upload everywhere.** Library is read-only by design; uploads and decisions
  only happen on project deliverable cards. Upload mode additionally needs
  Cloudinary env config, and is disabled with a visible note when absent.
- **Inbox.** A sidebar placeholder with a "Soon" badge, not wired.
- **Settings.** No settings surface exists at all.
- **Real-time.** The bell refreshes on focus and every 30 seconds; nothing
  pushes live.

---

## 9. One API-shaped trace of the same loop

For a developer's mental model, the loop above touches these server services
in order (`src/server/services/`):

```
auth            → better-auth: signup, email verification, session
workspace       → create, access checks for every /w/:slug route
invite          → createInviteFn (hashed tokens, Resend, 25/day cap),
                  backfill on verified session, accept/decline/revoke
request-service → submit → needs-info → accept(-into-project), thread
project-service → accept creates the project; members, lead, tags, status
deliverable-service → deliverable owner/deadline/status machine
task-service    → composer, assignees, status moves → status history
version-service → submit version, send for review, decide (+approvals
                  mirror, supersede transaction), feedback thread
notification-service → task_assigned, deliverable_assigned, version_review_*
                        events; never notifies the actor
library-service → read-only list + asset detail with decision history
```

Each state machine is a pure function in `workflow-states.ts`, covered by the
transition contracts in `workflow-states.test.ts` (34 vitest tests).
