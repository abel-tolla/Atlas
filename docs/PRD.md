# Product Requirements Document

Atlas is a responsive web app that pulls every calendar a person uses into one Today dashboard, then helps them plan the work and routines that fit around those events.

## 1. Overview

**Problem.** People keep classes, meetings, deadlines and personal plans in separate calendars (Google, Outlook, Canvas, Apple). None of them shows the whole day, and none helps turn a deadline into a realistic plan.

**Product.** Atlas has three parts that build on each other:

1. **Aggregation.** Events from all connected calendars in one place, read-only from the source.
2. **Planning.** Tasks broken into work blocks, and routines (gym splits, study habits) placed on the calendar.
3. **Assistant.** An AI that proposes plans and learns how long things really take you. It never changes the calendar without approval.

**Audience.** Everyone who plans a day: students, working professionals, and people building routines. Students are the first group we test with, because Canvas deadlines make the value obvious.

**Goals**

- A user sees all their commitments in one view within five minutes of signing up.
- A pasted assignment becomes a reviewed plan of tasks and work blocks in under two minutes.
- Plans get more accurate over time, measured by the gap between estimated and actual block time.

**Out of scope for now:** shared calendars, team scheduling, native mobile apps, two-way sync back to Google or Outlook.

## 2. Functional requirements

Each feature has an ID (F-01 and up) used across every tab. Priority labels are in the Feature List tab.

### Accounts and sync

| ID | Requirement |
| --- | --- |
| F-01 | Sign in with Google or Microsoft OAuth. No email and password accounts. |
| F-02 | Connect Google Calendar, listing sub-calendars with a visibility toggle. Minimum scopes, read-only. |
| F-03 | Connect Microsoft 365 and Outlook calendars on the same terms. |
| F-04 | Connect Canvas. Assignments import as dated events users can attach tasks to. |
| F-05 | Connect Apple Calendar through CalDAV. |
| F-06 | Sync engine: daily background sync plus a Sync Now button with a 60-second cooldown enforced on the server. Cached events stay visible if a provider is down. |
| F-07 | Webhook-driven real-time updates from Google and Microsoft. |
| F-08 | Disconnect an account, choose to keep or delete its synced events, and revoke stored tokens. |

### Calendar and events

| ID | Requirement |
| --- | --- |
| F-09 | Day, week and month calendar views with an event detail popover. |
| F-10 | Color by source (Google, Microsoft, Canvas, Apple, Atlas). |
| F-11 | Local layer on synced events: hide, add notes, set priority, mark overlap-friendly. A toggle shows hidden events and why each was hidden, backed by an event history log. |
| F-12 | Conflict detection. Overlaps are flagged unless an event allows overlap. The user resolves every conflict. |
| F-13 | Create, edit and delete Atlas-owned events (work blocks, routine sessions, personal events). |
| F-14 | Today dashboard: today's timeline, tasks, routines due and an inbox, with the calendar one click away. |

### Planning

| ID | Requirement |
| --- | --- |
| F-15 | Tasks with title, estimate, optional deadline and importance flag. A task attaches to an event or stands alone. |
| F-16 | Work blocks: scheduled time that can cover several tasks, and a task can span several blocks. |
| F-17 | Block tracking: one tap for Faster, About right or Longer, optional exact minutes, plus done, skipped or partial. |
| F-18 | Zones: named, colored weekly windows (Work, Sleep, Leisure) with rules for what may be placed in each. |
| F-19 | Buffer time between items (default 10 minutes) and a cap on continuous work (default 3 hours). |
| F-20 | Fixed weekly routines, placed automatically as Atlas events. |
| F-21 | Rolling-cycle routines (for example push, pull, legs, rest) with a per-routine choice to shift the cycle after a missed session. |
| F-22 | Target routines (for example three workouts a week) that the AI places for approval. |
| F-23 | Pause a routine for a date range, freezing its cycle position. |

### AI assistant

| ID | Requirement |
| --- | --- |
| F-24 | Chat panel on Calendar and Schedule views, and a floating bubble elsewhere that opens into a resizable sidebar. |
| F-25 | Read tools: get schedule, find free slots, get tasks, get planning stats. Only the requested date range reaches the model. |
| F-26 | Plan from instructions: paste assignment text, review tasks, estimates and suggested blocks, edit, then approve. |
| F-27 | Plan from a PDF upload through the same review screen. |
| F-28 | Proposals table and inbox. The AI writes proposals only; approving one creates the real events. |
| F-29 | Learning: per-user time-adjustment factors from tracked blocks, included in planning prompts. |
| F-30 | AI-proposed reschedules for Atlas-owned blocks and routine sessions. |
| F-31 | Chat thread persists until the user clears it. |

### Alerts, safety and platform

| ID | Requirement |
| --- | --- |
| F-32 | Custom alerts: up to 10 per event, task or routine, each with timing and channel (in-app, email). High-importance items bypass quiet hours. |
| F-33 | Alert presets that attach to a category (for example Exam alerts). |
| F-34 | Push notifications through PWA support. |
| F-35 | SMS alerts with a daily limit. |
| F-36 | Undo for anything Atlas writes, for 24 hours. |
| F-37 | Time zones: UTC storage, local display, routines anchored to local wall-clock time. |
| F-38 | Data export (JSON, plus ICS for Atlas-owned events) and full account deletion. |
| F-39 | Responsive layout, Today view designed phone-first. |
| F-40 | Security baseline: encrypted tokens, least-privilege scopes, TLS, no tokens in the browser. |

## 3. Data model and AI rules

The model changes from the original spec: Atlas-owned items and synced items share one events table, and everything the user does to a synced event lives in a separate layer so sync never overwrites it.

| Table | Holds |
| --- | --- |
| users, user\_preferences | Account, time zone, buffers, max stacked work, alert defaults. |
| connected\_accounts, source\_calendars | Provider links, encrypted tokens, sync status, which calendars are visible. |
| events | One table for synced and Atlas-created events, with a source column. Sync only writes the synced columns. |
| event\_overrides | The local layer: hidden flag, notes, priority, overlap-friendly, importance. |
| event\_history | Log of what happened to an event (hidden, skipped, moved, conflict flagged, conflict resolved). Feeds the show-hidden view and undo. |
| tasks | Title, estimate, minutes completed, deadline, importance, optional event link. |
| work\_blocks, block\_tasks | Scheduled time, and the many-to-many link between blocks and tasks. |
| block\_tracking | Outcome (done, skipped, partial), feel (faster, right, longer), actual minutes. |
| routines, routine\_sessions | The definition (type, cycle, position, zone, pauses) and the generated sessions for a rolling four-week window. |
| zones | Name, color, weekly windows, placement rules. |
| alerts, alert\_presets | Up to 10 per item, each with offset and channel. |
| proposals | Everything the AI suggests, with status pending, approved or dismissed. This is the AI section of the inbox. |
| planning\_stats | Per-user adjustment factors by task category. |
| chat\_threads | Persistent conversation, clearable by the user. |

**Rules for the AI**

1. The AI has read tools (schedule, free slots, tasks, stats) and propose tools (plan, blocks, reschedule, routine changes). It has no write access to events.
2. Propose tools write only to the proposals table. Approving a proposal is the only thing that creates real events.
3. Model output is validated against a strict schema. Malformed output is dropped and the user sees a retry message, never a bad proposal.
4. Routines are placed by a rules engine from the user's own definition, not by the model. A routine that lands on a conflict goes to the inbox.
5. Priority and importance are set by the user. The AI may suggest a flag.
6. Learning is computed: estimated versus actual minutes per category gives an adjustment factor (for example reading blocks take 1.4 times the guess), which is added to the next planning prompt.
7. The inbox stores proposals only. Conflicts, unmarked blocks, expired connections and routine clashes are computed live from the data.

## 4. Non-functional requirements, stack and risks

| Area | Requirement |
| --- | --- |
| Performance | Calendar range queries and conflict checks under 1 second. Sync completes in 5 to 10 seconds. First AI response in 3 to 5 seconds. |
| Security | TLS in transit, AES-256 for stored tokens, least-privilege OAuth scopes, no tokens exposed to the client. |
| Privacy | Only the requested date range is sent to the model. Chat history is kept until the user clears it. Users can export everything and delete everything. |
| Reliability | Cached events stay visible when a provider is down. The app works fully without the AI. Anything Atlas writes can be undone for 24 hours. |
| Accessibility | Keyboard navigation, visible focus rings, color never the only signal (source and conflict states also use icons or labels). |
| Compliance | Structure for FERPA-aligned handling of Canvas data and GDPR-style export and deletion. |

**Stack (unchanged from the original spec).** Next.js with TypeScript, Tailwind and shadcn/ui, Postgres on Neon or Supabase with Drizzle, Auth.js, Ollama for the model, Resend for email, Vercel for hosting. Push notifications need PWA support, and SMS needs a paid provider, so both are later.

**Risks**

| Risk | Mitigation |
| --- | --- |
| Google calendar scopes are sensitive, so unverified apps are limited to test users and refresh tokens expire after 7 days in testing | Stay in testing mode for now and note the expiry in the README. |
| Ollama cannot run on Vercel | Run it on a team machine behind a tunnel, with a single URL setting in one file so the host can change. |
| Canvas developer keys usually need school admin approval | Start with a personal access token or iCal feed instead of full OAuth. |
| Rolling cycles, zones and conflicts interact in ways that are hard to predict | Build the rules engine as plain tested functions, not model behavior. |
| Scope is large for a semester | Every feature is labeled in the MoSCoW tab, and the roadmap cuts at phase boundaries. |
