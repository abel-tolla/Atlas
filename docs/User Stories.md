# User Stories and Acceptance Criteria

Every story carries the feature ID it delivers. Stories for Won't features are not written.

## Accounts, sync and calendar

**US-01 (F-01) Sign in.** As a user, I want to sign in with Google or Microsoft so I don't need another password.

- Login offers Google and Microsoft. A first login creates my account, later logins reuse it.
- A failed or cancelled sign-in shows a clear error.
- Logged-out visitors are redirected away from every app page.

**US-02 (F-02) Connect Google.** As a user, I want to connect Google Calendar so my events appear in Atlas.

- Consent asks only for read-only calendar access.
- I see my sub-calendars and can show or hide each one.
- Events import into the unified events table, and syncing twice never duplicates them.

**US-03 (F-03) Connect Microsoft.** As a user, I want to connect Outlook or Microsoft 365 so my work meetings appear.

- Same consent, listing and duplicate rules as US-02.
- An expired token refreshes silently, or shows a re-connect banner if it can't.

**US-04 (F-04) Connect Canvas.** As a student, I want to connect Canvas so my assignments appear with their due dates.

- Assignments import as dated events with the course name.
- Changed due dates update the existing item, not a new one.
- I can connect with a personal access token or calendar feed if my school blocks OAuth.

**US-05 (F-05) Connect Apple Calendar.** As a user, I want to connect iCloud so my personal events are included.

- I can connect with an app-specific password over CalDAV.
- Credentials are stored encrypted. Events import as in US-02.

**US-06 (F-06) Keep my calendar current.** As a user, I want a daily sync and a Sync Now button so I can trust what I see.

- Every connected account syncs once a day in the background.
- Sync Now shows a spinner, then a success message, and is disabled for 60 seconds. The server enforces the cooldown too.
- If a provider is down, my last events stay visible with a "sync delayed" notice and a retry.

**US-07 (F-07, Could) Real-time updates.** As a user, I want changes to appear within seconds so I don't need to press Sync.

- A change in Google or Outlook shows in Atlas without a manual sync.
- A missed webhook is caught by the daily sync.

**US-08 (F-08) Disconnect an account.** As a user, I want to disconnect a calendar and choose what happens to its events.

- I'm asked whether to keep or delete the synced events.
- Stored tokens are removed and the account shows as revoked.
- Expired connections show a banner asking me to re-authenticate.

**US-09 (F-09, F-10) See everything in one calendar.** As a user, I want day, week and month views with each source colored so I can tell where an event came from.

- Week is the default, with Today, previous and next controls.
- Colors: Google blue, Microsoft blue, Canvas orange-red, Apple gray, Atlas indigo. Each event also shows a source label.
- Clicking an event opens its details: time, location, source, notes, priority.
- A week of events loads in under a second.

**US-10 (F-11) Hide, annotate and flag synced events.** As a user, I want to change how a synced event behaves in Atlas without touching the original.

- I can hide an event, add notes, set priority and mark it overlap-friendly.
- A re-sync never undoes any of these changes.
- A "show hidden" toggle lists hidden events with the reason (skipped, moved, conflict flagged, conflict resolved).
- Hidden events no longer block planning.

**US-11 (F-12) Spot conflicts.** As a user, I want overlaps flagged so I can decide which one wins.

- Overlapping events show a warning marker unless one allows overlap.
- More than three overlaps collapse into a "+N more" badge.
- Nothing is resolved for me. I choose which event keeps its slot, or mark both as fine.

**US-12 (F-13) Add my own events.** As a user, I want to create, edit and delete events inside Atlas.

- Atlas-owned events can be edited and truly deleted.
- Synced events cannot be edited in Atlas. The popover says to change them in the source app.

**US-13 (F-14) Start my day on Today.** As a user, I want a Today screen with an inbox and my calendar so I know what to do next.

- Today shows my timeline, tasks due, routine sessions and an inbox, with one click to the full calendar.
- The inbox shows conflicts, unmarked blocks, expired connections and pending AI proposals.
- First-time users see a useful starting state, not an empty screen.

## Planning: tasks, work blocks, zones and routines

**US-14 (F-15) Capture tasks.** As a user, I want to add tasks with an estimate and optional deadline so Atlas knows what I need to do.

- A task has a title, estimate, optional deadline and an importance flag, and can attach to an event (a midterm, a demo day) or stand alone.
- Tasks with deadlines appear on the calendar and in Today.
- Marking a task complete removes it from planning.

**US-15 (F-16) Schedule work blocks.** As a user, I want to place time on my calendar for one or more tasks so I know when I will do them.

- One block can cover several tasks, and one task can span several blocks.
- A task shows its estimate, minutes planned and minutes done.
- Placing a block on a busy time shows a conflict, which I resolve.

**US-16 (F-17) Mark blocks done in one tap.** As a user, I want to log how a block went in a single tap so tracking doesn't feel like work.

- After a block ends it appears in my inbox with Faster, About right and Longer buttons.
- I can add exact minutes, or mark the block skipped or partial.
- Unmarked blocks are listed, never guessed, and are left out of the stats.

**US-17 (F-18) Define zones.** As a user, I want named zones such as Work, Sleep and Leisure so Atlas only plans things where I allow them.

- I create zones with any name, color and weekly windows, and choose what each may hold.
- Onboarding offers starter zones I can edit.
- Nothing is auto-placed in a zone that forbids it. Sleep allows nothing by default.

**US-18 (F-19) Keep my plan realistic.** As a user, I want breaks between items and limits on stacked work.

- Default 10 minutes between items and no more than 3 hours of continuous work, both adjustable.
- Atlas never proposes back-to-back work blocks without a break.

**US-19 (F-20) Fixed weekly routines.** As a user, I want a routine that repeats on set days so it always lands on my calendar.

- I set days, time, length and zone, and sessions appear automatically for the next four weeks.
- A session that lands on a conflict goes to my inbox for me to resolve.
- Past sessions stay as history when I change the routine.

**US-20 (F-21) Rolling-cycle routines.** As a user, I want a routine like push, pull, legs, rest that rolls through its days.

- I define the order and length of the cycle and when it starts.
- When creating the routine I choose whether a missed session shifts the cycle or stays anchored to dates.
- Future sessions regenerate after a skip. Past ones stay.

**US-21 (F-22) Target routines.** As a user, I want to say "three workouts a week" and have Atlas find the slots.

- I set a target count and session length per week.
- Atlas proposes slots in the inbox. Nothing is placed until I approve.
- Weeks that can't fit the target show what's missing.

**US-22 (F-23, Could) Pause a routine.** As a user, I want to pause a routine for a trip or illness.

- I pick a date range, and no sessions are placed inside it.
- A rolling cycle resumes from where it left off.

## AI, alerts, privacy and platform

**US-23 (F-24) Chat with Atlas.** As a user, I want an assistant within reach on every screen.

- On Calendar and Schedule it is a side panel. Elsewhere it is a floating bubble that animates open into a resizable sidebar.
- It shows a typing indicator with a Cancel button, and a friendly message if the model times out.
- Every other part of the app still works if the AI is down.

**US-24 (F-25) Ask about my schedule.** As a user, I want to ask "When am I free this week?" or "Can I finish this before Friday?" and get a clear answer.

- The answer uses my real events and tasks for the range I asked about, and nothing outside it.
- Vague questions get a clarifying question (how long, which days).
- Free time respects my zones, buffers and work cap.

**US-25 (F-26) Turn instructions into a plan.** As a student or worker, I want to paste an assignment or brief and get a plan I can edit.

- A review screen shows tasks, estimated time per task and suggested work blocks.
- I can change tasks, estimates and times before approving.
- Nothing reaches my calendar until I approve.
- Estimates use my own adjustment factors once I have tracked blocks.

**US-26 (F-27) Plan from a PDF.** As a user, I want to upload instructions as a PDF and get the same review screen.

- Text PDFs are read. A scanned PDF shows a clear message if the text can't be read.

**US-27 (F-28) Approve what the AI suggests.** As a user, I want to review every AI suggestion in my inbox so I stay in control.

- Each proposal shows exactly what would be created or changed, with Approve, Modify and Dismiss.
- Approving creates the real events. Dismissing removes the proposal.
- Proposals stay in the inbox until I act, even if I close the chat.
- Output that doesn't match the schema is dropped, and I see a "try rephrasing" message.

**US-28 (F-29) Plans that get more accurate.** As a user, I want Atlas to learn how long things take me.

- Estimated versus actual time is tracked per category of task.
- The adjustment appears in the next plan, for example "Reading usually takes you 1.4 times your estimate".
- I can see and reset my adjustments.

**US-29 (F-30) Reschedule with the AI.** As a user, I want to say "move my study block to Thursday" and review a proposal.

- Only Atlas-owned blocks and routine sessions can be moved.
- Conflicts are checked before the proposal appears.

**US-30 (F-31) Keep my chat.** As a user, I want my conversation to persist so I can pick it up later.

- The thread stays until I clear it with one button.
- Clearing removes the thread but not my tasks, blocks or stats.

**US-31 (F-32) Alerts my way.** As a user, I want as many alerts as I need on important items.

- Up to 10 alerts per event, task or routine, each with its own timing (for example 1 week, 3 days, 2 days, day of) and channel (in-app or email).
- Items I mark high importance can alert through quiet hours. Others wait.
- Atlas alerts are separate from reminders set in Google or Outlook, which keep firing there.

**US-32 (F-33, F-34, F-35, Could) More alert tools.** As a user, I want presets, push and text messages.

- A preset such as "Exam alerts" attaches to a category.
- Push works once installed as a PWA. SMS has a daily limit per user.

**US-33 (F-36) Undo.** As a user, I want to reverse anything Atlas did for me.

- Approvals, routine sessions and bulk hides can be undone for 24 hours using the event history log.

**US-34 (F-37) Right time, wherever I am.** As a user, I want times shown in my current time zone.

- Changing my time zone re-renders every time.
- A 6 PM workout stays at 6 PM after I travel.

**US-35 (F-38) Take my data or delete it.** As a user, I want to export everything and delete my account.

- Export gives a JSON file and an ICS file of Atlas-owned events.
- Deleting an account removes events, tasks, stats, history, chat and tokens, after a confirmation step.

**US-36 (F-39) Use it on my phone.** As a user, I want to check my day from my phone.

- Today is designed for a phone width first and works without horizontal scrolling.
- The inbox, one-tap marking and chat all work on mobile.

**US-37 (F-40) Trust the security.** As a user, I want my connections to be safe.

- Tokens are encrypted and never sent to the browser.
- Each integration asks only for the minimum permissions.
- Everything travels over TLS.
