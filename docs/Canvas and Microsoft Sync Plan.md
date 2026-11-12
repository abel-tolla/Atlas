# Canvas and Microsoft Sync Plan

This phase replaces the calendar's mock data with real events from Canvas and Microsoft (Outlook and Microsoft 365), stored in Postgres on Neon. It covers the 13 GitHub issues in the Connect Canvas and Connect Microsoft Calendar epics, plus the groundwork they are blocked by.

## The issues

**Connect Canvas (epic #44).** All are Must.

| Issue | What it asks for |
| --- | --- |
| #189 | Write the user story |
| #190 (spike) | Connect with a personal access token or a calendar feed link. Explain where to find them. Store them encrypted, never in the browser |
| #191 | List courses, each with a show/hide toggle. Hidden courses are skipped by sync |
| #192 | Import assignments as dated events with the course name. No duplicates, read-only |
| #193 | A changed due date updates the same event. Local changes (hide, notes, priority) survive |
| #194 | Tasks can attach to an assignment and stay attached when its due date changes |
| #214 | Clear messages for a bad or expired token and for an unreachable Canvas site, with cached assignments still showing |

**Connect Microsoft Calendar (epic #10).** All are Should.

| Issue | What it asks for |
| --- | --- |
| #77 | Write the user story |
| #78 | Connect with read-only calendar consent, separate from signing in. Tokens encrypted, never in the browser |
| #79 | List sub-calendars, each with a show/hide toggle |
| #80 | Import events with recurring events expanded. No duplicates, read-only |
| #81 | Expired access tokens refresh silently. If that fails, a reconnect banner appears and cached events stay |
| #212 | Clear messages when the user cancels consent or a school or work account needs admin approval |

## What blocks this phase

Both epics say "Blocked by: Sync Events", and both need things that don't exist yet:

1. **A server.** The web app is a Vite single-page app with no backend. OAuth secrets, encrypted tokens and the database must live on a server (F-40).
2. **Signed-in users.** A connected account belongs to a user, so at least one sign-in method from the Login epic (#7) is needed.
3. **The sync engine** (Sync Events epic #9: #61 to #67). Its epic says it is blocked by Connect Google Calendar, but Canvas and Microsoft can't use it until it exists, so this phase builds it.

The plan therefore has five parts. Parts A and B are shared groundwork, and C and D are the two providers.

## Part A: Foundation

### Decisions

| Question | Decision |
| --- | --- |
| Server framework | Move the app to **Next.js** (App Router, TypeScript), as the PRD says |
| Sign-in library | **Auth.js**. Its plan is in [Login Plan.md](Login%20Plan.md) |
| Who owns the services | **The developers, together.** Every teammate is an owner of the Neon project, the Microsoft Entra app, the Google Cloud project and the Vercel project, so no one person holds the only key |

**Sharing secrets:** Vercel's environment variables are the single source of truth. Each developer runs `vercel env pull .env.local` to get them locally. Secrets never go in git, chat or the docs.

### Moving to Next.js

**Done.** The app now runs on Next.js 16. The calendar's view and date live in the address, and `.env*` files are git-ignored. The steps below record what was done.

The app lives in `web/` and moves in place. The components stay as they are, and only the shell around them changes.

1. **Scaffold the project.** Create a Next.js app in `web/`, remove `vite.config.ts`, `index.html` and `main.tsx`, and keep Vitest for tests.
2. **Move the shell.**
   - `styles.css` becomes `app/globals.css`, and the `@fontsource/alata` import goes in `app/layout.tsx`.
   - The theme script in `index.html` that runs before the first paint goes into the layout's `<head>` unchanged, with `suppressHydrationWarning` on `<html>`.
3. **Turn views into routes.** Each view becomes its own address, in place of the `view` state in `App.tsx`:
   - `/` for Today
   - `/calendar?view=week&date=2026-11-04` for the Calendar
   - `/settings`
   - placeholder pages for Schedule, Tasks and Routines

   Sidebar buttons become links. Real addresses are also what the Login epic needs to send people back to the page they asked for (#52).
4. **Mark client components.** Components that use state or the browser get `'use client'`. `calendarApi.ts` and the mock still work unchanged, so the move can be checked before any backend code lands.
5. **Check the move.** `npm test`, a build, and a look at Today and every calendar view in light and dark should match the Vite version before anything else is merged.

### Neon and Drizzle

- Create one Neon project. Give each teammate their own Neon branch for development, plus one branch for production. Branches are free and copy the schema.
- Use Drizzle ORM with the `@neondatabase/serverless` driver, and `drizzle-kit` for migrations committed to the repo.
- Use PGlite (Postgres in memory) for tests, so `npm test` needs no network or database.
- Add `.env*` to `.gitignore` before anyone creates an env file. It isn't ignored today.

### Schema

The tables follow the PRD's data model, plus a few fields sync needs.

| Table | Key columns |
| --- | --- |
| `users` | id, email, name, time_zone |
| Sign-in tables | Created by the sign-in library. These are separate from `connected_accounts`, so calendar consent stays apart from sign-in (#78) |
| `connected_accounts` | user_id, provider (`microsoft`, `canvas`), auth_type (`oauth`, `canvas_token`, `canvas_feed`), label (email or school), base_url (Canvas), encrypted access token, encrypted refresh token, token_expires_at, encrypted feed URL, status (`active`, `needs_reconnect`, `error`), last_synced_at, last_manual_sync_at, last_error |
| `source_calendars` | account_id, external_id, name, kind (`calendar` or `course`), visible. Unique on (account_id, external_id) |
| `events` | user_id, source, source_calendar_id, external_id, title, starts_at and ends_at (timestamptz, UTC), all_day, kind (`event` or `deadline`), location, course_name, source_url, category (Atlas only), deleted_at, last_seen_run_id. **Unique on (source_calendar_id, external_id)**, which is what stops duplicates |
| `event_overrides` | event_id, notes, priority, important, hidden, overlap_friendly. Sync never writes here (#64) |
| `event_history` | user_id, event_ids, kind, summary, hid, at. Same shape as the mock |
| `acknowledged_conflicts` | user_id, event pair |
| `sync_runs` | account_id, trigger (`connect`, `manual`, `daily`), started_at, finished_at, status, counts, error |

Two indexes cover the calendar's range query: `events (user_id, starts_at)` and `events (user_id, ends_at)`.

### Sign-in and secrets

- Sign-in is the Login epic, planned separately in [Login Plan.md](Login%20Plan.md). This phase needs at least one working sign-in method before Part C.
- Encrypt tokens with AES-256-GCM using Node's `crypto`. The key lives in `TOKEN_ENCRYPTION_KEY` and each value gets its own random IV. Tokens are decrypted only inside sync code and never logged or returned by any route.
- Env vars: `DATABASE_URL`, `TOKEN_ENCRYPTION_KEY`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, the sign-in secret and `CRON_SECRET`.

## Part B: Sync engine (from epic #9)

### One adapter per provider

Each provider gets one small adapter, and everything else is shared:

```ts
interface ProviderAdapter {
  listCalendars(account): Promise<RemoteCalendar[]>      // Microsoft calendars, Canvas courses
  fetchEvents(account, calendar, window): Promise<RemoteEvent[]>
}
// RemoteEvent: externalId, title, startsAt, endsAt, allDay, kind, location, courseName, sourceUrl
```

### `syncAccount(accountId, trigger)`

1. Refresh the access token if needed (Microsoft only). If the provider rejects the refresh, set the account to `needs_reconnect` and stop.
2. Sync the calendar list, adding new calendars as visible and keeping the toggles of existing ones.
3. For each **visible** calendar, fetch events in the window: 60 days back and 180 ahead (#62).
4. In one transaction:
   - Upsert into `events` on (source_calendar_id, external_id), updating **only the synced columns** (#61, #64).
   - Stamp each seen row with this run's id.
   - Soft-delete rows in that calendar and window that weren't seen (#63).
5. Write a `sync_runs` row and update `last_synced_at` (#65).

### Other rules

- **Removed events** (the open question #63 and #193 refer to): set `deleted_at` instead of deleting the row. Views skip it, its overrides and attached tasks are kept, and a history entry says "Removed in Canvas" or "Removed in Outlook". If it comes back, clear `deleted_at`.
- **Errors** (#67): on a 5xx, a timeout or a 429 rate limit, retry up to 3 times with backoff, then mark the run as failed. Cached events stay visible, and the API reports the sync as `delayed`, which the calendar's banner already handles.
- **Daily sync** (#65): Vercel Cron calls `/api/cron/daily-sync` with `CRON_SECRET`. Each account syncs inside its own try/catch, so one failure doesn't stop the others.
- **Sync Now** (#66): `POST /api/sync` refuses a second manual sync within 60 seconds using `last_manual_sync_at`, returning 429 with Retry-After. The button disables itself too.
- **Time zones** (F-37): timestamps are stored in UTC. All-day events keep their date with no time zone shift, and the browser converts everything else to local time.

The engine is tested with a fake adapter and PGlite. These tests cover no duplicates on re-sync, local changes surviving (this is #88 against the real database), removals and one account failing.

## Part C: Microsoft (epic #10)

**Setup.** Register one app in Microsoft Entra ID that accepts work, school and personal accounts (the `common` endpoint). Add redirect URIs for localhost and Vercel. Request only the delegated permissions `Calendars.Read` and `offline_access`.

**#78 Connect.** Flow:
- Settings → `GET /api/connect/microsoft` → redirect to Microsoft with `state` and PKCE.
- `GET /api/connect/microsoft/callback` swaps the code for tokens on the server, stores them encrypted, then starts the first sync.
- Nothing token-related goes in a URL.

**#79 Calendars.** `GET /me/calendars` fills `source_calendars`. Settings shows each one with a toggle, which takes effect on the next sync. The calendar query also filters out hidden calendars right away.

**#80 Events.** `GET /me/calendars/{id}/calendarView` over the window.
- Microsoft expands recurring events into instances, including changed and cancelled ones (#62).
- Send `Prefer: outlook.timezone="UTC"`, select only the needed fields, and follow `@odata.nextLink` pages.
- Use the event's `id` as the external id.
- Fetching the whole window each time keeps the first version simple. Graph's delta queries can come later as an optimization.

**#81 Stay connected.** Refresh about 5 minutes before the access token expires, and save the new refresh token Microsoft returns. If the refresh fails with `invalid_grant`, set `needs_reconnect`, which shows the reconnect banner (#104).

**#212 Consent problems.** Map the callback's errors to plain messages:
- `access_denied` (the user cancelled): "You cancelled. Nothing was connected."
- `AADSTS65001` or `AADSTS90094` (an admin must approve): explain that their school or work blocks it and who to ask.

## Part D: Canvas (epic #44)

**#190 Spike first.** It needs no backend, so start it on day one. With a real student account, find out:
- whether the school allows personal access tokens (Account → Settings → New access token)
- whether the calendar feed link works (Calendar → Calendar Feed)
- what each one returns

Test against a free Canvas account with a made-up course too, so tests never use real student data (FERPA).

**Two ways to connect, the same pipeline after that:**

| | Personal access token (recommended) | Calendar feed link (fallback) |
| --- | --- | --- |
| User gives | School Canvas URL and a token | The feed URL |
| Courses (#191) | `GET /api/v1/courses?enrollment_state=active` | Taken from the `[Course]` part of each event title |
| Assignments (#192) | `GET /api/v1/courses/:id/assignments` (`due_at`, `html_url`) | Parsed from the ICS file with `ical.js` |
| Stable id | The assignment's id | The ICS `UID` |

**Rules for both:**
- Follow the `Link` header for pages and watch `X-Rate-Limit-Remaining`.
- The feed URL is as secret as a token, so it's encrypted too.
- Assignments become `kind = deadline` events at their `due_at`, with the course name. Assignments without a due date are skipped.
- The calendar shows deadlines in the all-day row as "Due 11:59 PM".
- `source_url` links back to the assignment, for "Open in Canvas".

**#193 Due dates.** Handled by the upsert: same external id, new `starts_at`. Overrides sit in their own table, so they survive.

**#194 Attach tasks.** The Tasks epic isn't built yet. For now, give `tasks.event_id` a foreign key to `events.id` (`on delete set null`). Upserts keep the same `events.id`, so attachments survive a date change. The task picker comes with the Tasks epic.

**#214 Connection problems.**
- 401 → `needs_reconnect`: "Your Canvas token was revoked or expired. Make a new one."
- A DNS failure, timeout or 5xx → `delayed`: "Your school's Canvas didn't answer. Showing saved assignments."
- A 404 on the feed → `needs_reconnect`.

## Part E: Wiring the frontend

- **Data:** `web/src/calendarApi.ts` was built as the only seam, so swap its function bodies for `fetch` calls. Keep the mock behind `VITE_USE_MOCK=1` so frontend work never needs a database.
- **Routes:**

| Area | Routes |
| --- | --- |
| Events | `GET /api/events?from&to`; `POST`, `PATCH` and `DELETE /api/events/:id` (Atlas only, 403 for synced); `PUT /api/events/:id/overrides`; `GET /api/events/:id/history` |
| Conflicts | `POST /api/conflicts/resolve` |
| Connections | `GET /api/connections`; `PATCH /api/connections/:id/calendars/:calendarId` |
| Connecting | `POST /api/connect/canvas`; the two Microsoft connect routes |
| Syncing | `POST /api/sync`; `GET /api/cron/daily-sync` |

- **Settings → Connections** (replaces the placeholder): a card for Microsoft and one for Canvas.
  - Each card shows its status (Connected, Not connected, Needs reconnect, Error), last synced time, a toggle per calendar or course, and Sync Now.
  - The Canvas card has a two-step form: pick token or feed link, with instructions and screenshots for finding them.
- **Header:** Sync Now calls `POST /api/sync` and shows the real last-sync time.
- **Calendar:**
  - Canvas deadlines go in the all-day row with their time.
  - The popover's read-only note links to the source.
  - The `delayed` and `needs_reconnect` statuses drive the existing banner and the reconnect banner (#104).

## Suggested order

| Step | Work | Who can do it in parallel |
| --- | --- | --- |
| 1 | Move to Next.js, `.gitignore` fix | One person |
| 1 | Neon project and branches, schema and migrations | One person |
| 1 | Canvas spike (#190), Entra app registration | One person each, no code needed |
| 2 | Login epic (see [Login Plan.md](Login%20Plan.md)), token encryption, sync engine with a fake adapter and tests | Two or three people |
| 3 | Microsoft adapter and connect flow (#78 to #81, #212) | One person |
| 3 | Canvas adapter and connect form (#191 to #193, #214) | One person |
| 4 | API routes, swap `calendarApi.ts`, Settings → Connections, Sync Now, cron | One or two people |
| any | User stories #77 and #189, `tasks.event_id` for #194 | Anyone |

**Done when:**
- A signed-in user connects Microsoft and Canvas and picks calendars and courses.
- Real meetings and assignments show in the calendar with no duplicates after several syncs.
- A changed due date moves the same event, and local notes and hides survive.
- An expired or broken connection shows the right message while cached events stay visible.

## Risks

| Risk | Mitigation |
| --- | --- |
| The school blocks Canvas tokens | The spike finds out first. The feed link is the fallback |
| A school or work Microsoft account needs admin approval | #212's message explains it. Test with personal Outlook accounts |
| Real student data in tests or logs (FERPA) | Use a free test Canvas account with made-up courses, and never log tokens or titles |
| Vercel function time limits on big calendars | Sync accounts one at a time and fetch the window in pages. One account per invocation if needed |
| Roadmap order | The roadmap puts Canvas in Phase 5. Pulling it into this phase is a deliberate change worth noting there |

## Open questions

- Is the soft delete for removed events (above) the answer the team wants to the open question in #63 and #193?
