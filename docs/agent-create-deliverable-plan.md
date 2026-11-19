# Create-a-deliverable agent — plan

Design agreed in session, 2026-11-11. **No code written yet.** This file is the
agreement; changes to it are changes to the feature.

---

## 1. The promise

> Done when a project lead opens the shortcut box on a project page, types
> "create a deliverable for the teaser video, deadline 2026-03-01", sends it,
> and a real card with their own name lands in that project's work tab within
> seconds — unassigned, undoable for ten seconds, and still created if the page
> changes underneath them.

It fills a form. It does not plan, suggest, or reorganise work.

---

## 2. What the person sees

```
project page
  ├─ press shortcut → box opens over the page (nothing else moves)
  ├─ type one sentence → send
  ├─ box stays open: "working…"
  ├─ box closes; card is in the work tab, highlighted
  ├─ activity feed gains one line: "created Teaser video"
  └─ for ten seconds the card offers undo → card and feed line disappear
```

No chat, no wizard, no screen changes. Nothing to read afterwards unless they
want to.

---

## 3. Rules we locked

| Question | Decision |
|---|---|
| Who is credited | The person who typed it. The card carries their name. |
| How much it creates | One card. A form fill, never a breakdown into several. |
| Where it writes | The project of the page it was opened on. The page decides; the sentence never does. |
| Where the box exists | Project pages only. Anywhere else it does not open. |
| Assigning people | Never. Every card lands unassigned; a human assigns. |
| Repeats | Same words, same project, same person, within 60 seconds → one card. Later, or by someone else → a new card. |
| Undo | Ten seconds. The card is marked deleted, hidden everywhere, its notification and feed line go with it. |
| Losing the page | The work finishes regardless. The result does not depend on the tab staying open. |
| During the run | The box stays open saying "working…", then closes. |
| After the run | One line in the project's activity feed, success or failure. |
| Failure | The feed says it failed, nothing is created, nothing retries, nobody is blocked. |
| The thinking | Google's free tier. |

**Why the repeat rule is scoped to the person:** two different people asking for
the same thing is two jobs. One person double-pressing is one.

---

## 4. What gets built

Four pieces. Nothing else.

### 4.1 The sentence box

A command box (the project already has the shadcn command component at
`src/components/ui/command.tsx`) mounted in the project page shell only. On
send it holds open until the result arrives, then closes. It is the only new
surface.

### 4.2 The background action

One server-side action, reachable only with a signed-in session:

1. Re-reads the project from the page context and confirms the person may
   create deliverables there (same check as today's manual create:
   `canManageDeliverables` in `src/server/services/work-permissions.ts`).
2. Asks the model for four fields — title, description, type, deadline.
   Nothing else is accepted from it. No workspace, project, owner, or user id
   may come from the sentence or the model; those come from the session and the
   route.
3. Rejects the result if a title is missing or the reply is unusable.
4. Creates the card through a service function that mirrors today's
   `createDeliverable` in `src/server/services/deliverable-service.ts`, minus
   the owner.
5. Writes the feed line through the existing `createProjectUpdate`
   (`kind: "progress_update"`).
6. Records the run (sentence, outcome, created card id) so a closed tab does not
   lose the result and so undo knows what to remove.

### 4.3 Cards can be marked deleted

`deliverables` has no way to be undone today. This adds a "deleted" mark and a
timestamp. Every screen that lists deliverables must skip deleted ones —
project work tab, home, my tasks, request pages, version counts, notification
links. **This is the piece with the reach; the rest is local.** One screen
missed and a deleted card reappears there.

Undo itself: allowed only for the person who created it, only within ten seconds
measured on the server against the card's creation time — not a browser timer,
so a refresh does not grant a second window.

### 4.4 The failure line

Same feed, same writer, different words. It is the only place a failure is ever
reported. Nothing half-created may survive a failure — the card and the feed
line are written together or not at all.

---

## 5. What the model is allowed to do

| It may produce | It may not produce |
|---|---|
| title | any id of any kind |
| description | an owner or assignee |
| type (free text) | a project or workspace |
| deadline as a real date | permission to act |

Anything in the sentence that looks like an instruction to go elsewhere is just
text. The sentence is data, not authority.

**Deadline:** a date the user did not write explicitly is not invented. "Next
Friday" may be read as a date, but the card shows the date it chose, so nothing
is silently converted.

---

## 6. Still open

| Question | Current default |
|---|---|
| "…and assign it to Daniel" | Card lands unassigned; feed line notes the owner was left for a person. Not refused. |
| Failure entries live in the same feed as real activity | Accepted. Honest, slightly noisier in a demo. |
| Agent attribution in the feed line | Plain activity wording ("created Teaser video"). No robot name. Change if the demo needs one. |

---

## 7. The harness

Five sentences. The expected result is written down **before** running, and the
same five run against a fresh demo project each time.

| Sentence | Expected |
|---|---|
| "Create a deliverable for the teaser video, deadline 2026-03-01" on a project page | One card, the typist's name, that date, no owner; one feed line |
| The same sentence sent twice within a minute | One card |
| The same sentence again after a minute | A second card |
| "Create a deliverable" (no real content) | Failure line, nothing created |
| "…and assign it to Daniel" | Card created unassigned, feed notes the owner was left for a person |

Plus one that is not a sentence: opening the shortcut anywhere but a project
page must do nothing at all.

These live next to the code as tests on the pure parts (sentence → fields,
repeat detection, "may this person create here"), with the provider faked. The
network call is exercised by hand, once, against the real key.

---

## 8. Demo checklist

"Must work first time" is a rehearsal requirement as much as a code one.

- [ ] Clear the demo project's cards before starting.
- [ ] Rehearse the exact sentence in the exact project five times.
- [ ] Confirm the free-tier quota is not near its limit on the day.
- [ ] Have the failure line look decent — it may be the thing on screen if the
      network is bad.
- [ ] The card appears highlighted before anyone has to point at it.

---

## 9. Not in scope

- Chat, memory, follow-up sentences, "make it the other project".
- Breaking a sentence into several cards.
- Assigning people, recommending people.
- Acting on any page but a project page.
- Undo after ten seconds, un-deleting, a deleted-items screen.
- Any second action (moving status, commenting) — the shape allows it later,
  the build does not include it.

---

## 10. Build order

Slices, each shippable on its own. The model arrives fourth, not first — the
action must work before the thinking does.

1. **Rules as pure code + harness.** Sentence → fields with a stub, the repeat
   rule, the permission check. Tests green, nothing on screen.
2. **Create behind the scenes.** Card lands, feed line posted, run recorded.
   Triggered from a test or a temporary button, not the real box yet.
3. **Undo.** Deleted mark, ten-second server check, feed line and notification
   removed, every list skips deleted cards.
4. **Real model.** Google key wired in, stub removed, the five sentences run for
   real.
5. **The box.** Mounted on project pages only, stays open while working.
