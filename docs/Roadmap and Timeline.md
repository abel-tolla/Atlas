# Project Roadmap and Timeline

The roadmap has six phases. The first four deliver the MVP demo: sign in, see events from two calendars, plan work, and approve an AI-suggested block. Weeks are relative to the project start because the CS 321 deadline hasn't been set here. Swap in calendar dates once it is, and cut at a phase boundary if time runs short.

| Phase | Weeks | Delivers | Exit gate |
| --- | --- | --- | --- |
| 0. Foundation | 1 | Repo, deploy, database, schema, token encryption, time-zone handling, responsive shell (F-01, F-37, F-39, F-40) | A user signs in on a deployed site and sees an empty Today screen on a phone. |
| 1. One calendar | 2 to 4 | Google and Microsoft connect, sync engine, calendar views, source colors, local layer with hidden events and history, conflict flags, Atlas-owned events, disconnect, export and delete (F-02, F-03, F-06, F-08, F-09, F-10, F-11, F-12, F-13, F-38) | Real events from two accounts show in one calendar, and a re-sync never loses a local edit. |
| 2. Plan and track | 5 to 7 | Today dashboard and inbox, tasks, work blocks, one-tap tracking, fixed weekly routines (F-14, F-15, F-16, F-17, F-20) | A user adds a task, schedules a block, marks it done in one tap, and a routine appears for the next four weeks. |
| 3. AI assistant (MVP demo) | 8 to 10 | Chat panel and bubble, read tools, proposals and inbox approval, plan from pasted instructions (F-24, F-25, F-28, F-26) | A pasted assignment becomes a reviewed plan, and approving it puts blocks on the calendar. The model never writes directly. |
| 4. Smarter planning | 11 to 13 | Zones, buffers, rolling and target routines, learning from tracked time, AI reschedules, persistent chat, PDF input, undo (F-18, F-19, F-21, F-22, F-29, F-30, F-31, F-27, F-36) | A rolling routine shifts after a missed day, and a second plan uses adjusted estimates. |
| 5. More sources and alerts | 14 to 16 | Canvas, Apple Calendar, custom alerts by email and in-app, webhooks, routine pause, alert presets (F-04, F-05, F-32, F-07, F-23, F-33) | A Canvas assignment shows up and fires a 1-week, 3-day and day-of alert. |
| 6. Later | after launch | Push (PWA), SMS, native apps, shared availability, the resolve doc (F-34, F-35 and the Won't list) | Chosen from user feedback. |

**Rhythm.** Two-week sprints, with a demo at the end of each. Each phase ends at a gate, and a phase isn't done until its gate passes. Phase 1 and 2 are the riskiest, since sync and the conflict rules everything else relies on.

**Research spikes.** Run spikes 1, 2, 3 and 5 (daily view layouts, inbox layout, timeline with zones, first-run) during Phase 0 and 1, before the Today view is built in Phase 2. Run spike 4 (testing one-tap marking with 3 to 5 people) as soon as the first clickable version of tracking exists in Phase 2.

**Team split.** After Phase 0, each of the four people takes a vertical slice end to end: for example sync and sources, calendar and Today, tasks and routines, AI and alerts.
