# Atlas Planning Pack

Oct 15, 2026 · @Anonymous Ape

Atlas is a day planner for everyone that merges Google, Microsoft, Canvas and Apple calendars into one Today dashboard, then helps you plan work blocks and routines around your real schedule.

This pack has seven tabs: PRD, Feature List (MoSCoW), User Personas, User Stories and Acceptance Criteria, Roadmap and Timeline, Competitor Analysis, and GitHub Issues.

## Decisions locked

| Area | Decision |
| --- | --- |
| Audience | Everyone, not only students. Atlas is a day planner; pulling every calendar into one dashboard is the core feature. |
| Platform | Responsive web, Today view designed phone-first. Native iOS and Android later. |
| Synced events | Read-only from the source. Users can hide, annotate, set priority and mark overlap-friendly in a local layer that sync never overwrites. |
| Hidden events | Kept, not deleted. A toggle shows them with the reason (skipped, moved, conflict flagged or resolved). Hidden events stop blocking planning. |
| Recurring events | The provider expands recurrences into instances. Rolling window of 60 days back and 180 days ahead. |
| Priority and conflicts | The human decides. Atlas flags conflicts, events can allow overlap (for example working during a lecture), and the AI never sets priority. |
| Core model | Event, then Tasks, then Work Blocks. No separate project or milestone layer. The name for the thing you work toward is still open. |
| Routines | Fixed weekly, rolling cycle (for example push, pull, legs, rest) or a target per week. Missed sessions shift the cycle if the user chose that. Routines can be paused by date range. |
| Zones | User-named zones (Work, Sleep, Leisure) with rules for what may be placed in each. Default buffers between items and a cap on stacked work. |
| Tracking | One tap to mark a block Faster, About right or Longer, with optional exact minutes. Unmarked blocks stay out of the stats. |
| AI learning | A per-user time-adjustment factor computed from tracked blocks and fed into the planning prompt. No fine-tuning. |
| AI writes | The AI only proposes. Proposals sit in an inbox until approved. Routine sessions are placed by a rules engine from definitions the user wrote. Conflicts always go to the user. |
| Plan intake | Paste text or upload a PDF, then review and edit tasks, estimates and suggested blocks before anything is saved. |
| Alerts | Up to 10 per event, task or routine, each with its own channel and timing, plus reusable presets. Atlas does not import Google or Outlook reminders. High-importance items can bypass quiet hours. |
| Home screen | Today view with an inbox and a calendar. The AI is a panel on Calendar and Schedule, and a floating bubble that opens into a resizable sidebar elsewhere. |
| Time | Stored in UTC, shown in local time. Routines stay anchored to local wall-clock time. |
| Chat history | Kept until the user clears it. The spec's old privacy line (no history beyond the session) is replaced. |
| Safety nets | Anything Atlas writes can be undone for 24 hours. The app works fully without the AI. |
| Out of scope | Single-user accounts only. Sharing and shared availability are a Later idea. |

## Open items

- [ ] **Naming:** a word for the dated thing you work toward (midterm, demo day, presentation, PR). "Project", "deliverable" and "milestone" were all rejected. Until then the docs say Event with Tasks attached.
- [ ] **Spike 1:** review how Sunsama, Motion, Akiflow and Reclaim lay out a daily view.
- [ ] **Spike 2:** decide the inbox layout (one list, grouped by type, or tabs).
- [ ] **Spike 3:** show a day's timeline and zones together without clutter.
- [ ] **Spike 4:** test the one-tap mark-as-done with 3 to 5 people.
- [ ] **Spike 5:** design the empty state and first-run experience.
- [ ] **Later idea:** a "resolve doc" where users write rules for settling conflicts (for example, move the workout to 10 PM if dinner runs long).
