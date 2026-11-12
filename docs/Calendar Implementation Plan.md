# Calendar Implementation Plan

This plan covers the Calendar section of the web app and the 27 GitHub issues labelled `area:calendar`. All of them are open, unassigned and in the Phase 1: One Calendar milestone. The focus is epic #11 (Calendar View), followed by the three epics that build on it.

## The four epics

| Epic | Issues | Covers |
| --- | --- | --- |
| #11 Calendar View | #68 to #76 | Day, week and month views, source colors and legend, event popover, loading, empty and error states, phone and keyboard use, performance |
| #13 Conflicts | #89 to #94 | Overlap detection, conflict marker, "+N more" badge, resolve dialog, logging each resolution |
| #12 Hide, Notes and Priority | #82 to #88 | The local layer on synced events: hide, notes, priority, overlap-friendly, history log, re-sync safety test |
| #14 Your Own Events | #95 to #99 | Create, edit and delete Atlas events, the event form, drag to move, and the "edit in the source app" message |

## Where the code stands

- **No backend yet.** `web/` is a frontend demo running on mock data in `web/src/data.ts`. Epic #11 is formally blocked by Sync Events, so we build the views against a mock data layer shaped like the PRD's `events` and `event_overrides` tables. When the API exists, only that layer changes.
- **The event model covers one day only.** `CalendarEvent.start` is minutes after midnight, with no date, location or notes. The calendar needs real dates first.
- **Useful pieces already exist.** `Timeline.tsx` has an hour grid, a now line and two-lane overlap layout. The sidebar lists the sources with colored dots, and the CSS colors events by `data-source`. `App.tsx` already routes to `'Calendar'`, which currently renders `Placeholder`.
- **Naming mismatch.** The code uses `outlook` and "Outlook". Issue #70 and the PRD say "Microsoft". We need to pick one.

## Calendar View (epic #11), step by step

### Step 0: Data layer (supports every issue below)

- Give `CalendarEvent` real dates: `start` and `end` as ISO strings, plus `allDay`, `location`, `sourceCalendarId` and `readOnly` (true for synced events).
- Add an `EventOverride` type (notes, priority, importance, hidden, overlap-friendly) and merge it into events when they are read. This previews #83.
- Add an async `getEvents(rangeStart, rangeEnd)` with a short fake delay and a status of `ok`, `loading`, `delayed` or `no-calendars`. The views handle real loading and error cases from the start.
- Rewrite the mock data as a realistic two-week schedule. The Today view reads today's events from the same source.
- Use `date-fns` for week and month math.

### Step 1: Shell and Week view (#68)

- `CalendarView` replaces the Placeholder. App holds `{ mode, anchorDate }` so the date position survives switching views.
- The toolbar has Today, previous and next buttons, a range label (for example "Nov 2 to 8, 2026") and a Day / Week / Month switcher.
- The week grid has 7 day columns, an all-day row, an hour column and the now line.
- Move the Timeline overlap logic into a shared `layoutDay(events)` that handles any number of lanes, not just two. The Today timeline and the calendar both use it.

### Step 2: Day and Month views (#74, #69)

- Day view is the week grid with one column.
- Month view is a 6 by 7 grid of event chips. Clicking a day number opens that day in Day view.

### Step 3: Source colors and legend (#70)

- Reuse the existing `data-source` colors, and add a source label or icon to each event so color is never the only signal.
- The sidebar's Calendars list acts as the legend on desktop. Phones get a compact legend in the toolbar.

### Step 4: Event detail popover (#71, also covers #98)

- Shows time, location, source, notes and priority.
- Synced events show "Edit this in Google Calendar" (or the matching source).
- Escape or a click outside closes it, and focus returns to the event.

### Step 5: Loading, empty and error states (#72, #75)

- Gray skeleton blocks while events load.
- A "connect a calendar" prompt when nothing is connected.
- When a provider is down, cached events stay visible with a "sync delayed" banner.

### Step 6: Keyboard and phone (#73, #75)

- Events are focusable buttons with visible focus rings. Arrow keys move between days, and T, D, W and M are shortcuts.
- At phone width the calendar defaults to Day (or a 3-day view), so there is no horizontal scrolling.

### Step 7: Performance (#76)

- A seed function generates about 5,000 events.
- Events are filtered by date range before layout, and the layout is memoized per day.
- Measure the time to render a week. The target is under 1 second.

## After Calendar View

- **Conflicts (#89 to #94).** The overlap query (#90) is a pure function, so it can start alongside Step 1. It needs a test runner, so we add Vitest. The marker (#91), the "+N more" badge (#92) and the dialog (#93) build on the Step 1 layout. The Today inbox already has a demo of resolving a conflict that we can reuse.
- **Your Own Events (#95 to #99).** The form and create, edit and delete can run against the mock layer. Drag to move (#99) comes last.
- **Hide, Notes and Priority (#82 to #88).** Mostly backend work (the history helper and the re-sync test). The UI part is the controls inside the popover and the "show hidden" toggle.

## Suggested order

1. One person does Steps 0 and 1, since everything else depends on them.
2. Then three people work in parallel on Steps 2, 3 and 4, with the overlap query (#90) alongside.
3. Then Steps 5 and 6, and Step 7 last.
4. The user-story issues (#82, #89, #95) can be written at any time.

## Decisions

- **Backend:** the calendar runs on mock data for now. All reads go through `web/src/calendarApi.ts`, so only that file changes when the API exists.
- **Naming:** the source is called Microsoft (`microsoft` in code).
- **Dependencies:** `date-fns` for dates and Vitest for tests (`npm test` in `web/`).

## Progress

Steps 0 to 7 and the frontend work for the three follow-on epics are built on mock data. `npm test` in `web/` runs 58 tests. Changes last until the page reloads, because the store is in memory.

| Issue | Status | Where |
| --- | --- | --- |
| #68 See my week | Done | `components/calendar/TimeGrid.tsx`, week is the default on desktop |
| #69, #74 Day, week and month | Done | `CalendarToolbar.tsx`, `MonthGrid.tsx`. Clicking a day in Month or Week opens it |
| #70 Source colors and legend | Done | `parts.tsx`: a lettered mark per source, plus the legend |
| #71 Event details | Done | `Popover.tsx`, `EventDetails.tsx`. Escape and outside clicks close it |
| #72, #75 Loading, empty and error states | Done | Skeleton blocks, a connect prompt and a sync delayed banner |
| #73, #75 Phone and keyboard | Done | Phones open on Day. Shortcuts T, D, W, M, J, K and C. Arrow keys move around Month |
| #76 Performance | Done | A test with 5,000 events. `?mock=stress` logs timings in the browser console |
| #83 Merge overrides | Done | `calendarApi.ts` `queryEvents` |
| #84 History helper | Done | One entry per action, shown in the popover's History |
| #85, #86 Hide and the user's own settings | Done | Controls in the event popover |
| #87 Show hidden | Done | Toolbar toggle. Hidden events show their reason |
| #88 Re-sync test | Done, against the mock | `calendarApi.test.ts`. Repeat it against the real sync once it exists |
| #90 Overlap query | Done | `conflicts.ts` and its tests |
| #91 Conflict marker | Done | In all three views |
| #92 "+N more" badge | Done | `layout.ts` folds groups of three or more |
| #93, #94 Conflict dialog and log | Done | `ConflictDialog.tsx`. Keeping one hides the other |
| #96, #97 Create, edit and delete, and the form | Done | `EventForm.tsx`. Synced events are refused |
| #98 "Edit in the source app" message | Done | In the popover, and when someone tries to move a synced event |
| #99 Drag to move | Done | Mouse drag, or Alt + arrow keys. Touch screens use the form |
| #82, #89, #95 User stories | Drafted | US-10, US-11 and US-12 in `User Stories.md`. Each still needs a teammate's review |

**Still to do when the backend exists:** swap the bodies of the functions in `calendarApi.ts` for API calls, store overrides, history and acknowledged conflicts in their tables, and run the re-sync test against the real sync engine.

**Mock switches:** add `?mock=slow`, `?mock=delayed`, `?mock=empty`, `?mock=error` or `?mock=stress` to the URL.
