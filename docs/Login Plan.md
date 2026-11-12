# Login Plan

This plan covers the Login epic (#7): signing up and signing in with an email and password, or with Google or Microsoft. It also covers email verification, password reset, keeping every page behind sign-in, and sessions with log out. It copies the sign-up and sign-in flow of most modern apps. Every other feature needs to know who the user is, so this epic comes first.

**This changes an earlier decision.** The Feature List (F-01) said Atlas has no email and password accounts. That is no longer true, and F-01 must be updated to match. See [Docs to update](#docs-to-update).

**Decisions made:** Next.js (App Router), Auth.js, Postgres on Neon with Drizzle, hosting on Vercel, and Resend for email. The developers jointly own every service. The move to Next.js is described in [Canvas and Microsoft Sync Plan.md](Canvas%20and%20Microsoft%20Sync%20Plan.md#moving-to-nextjs) and has to happen first.

**Auth.js does not do sign-up, verification or reset.** It handles Google, Microsoft and the sign-in step for passwords (the Credentials provider). Atlas writes the rest itself: the sign-up form, password hashing, verification and reset emails, and rate limits. Auth.js also can't keep a database session for a password login. The plan below solves this in [Server-side sessions](#server-side-sessions-on-top-of-jwt).

## Status

Built in `web/src` (Nov 2026): the login tables in `db/schema/auth.ts` with the migration `web/drizzle/0001_login.sql` (on top of the Neon work's `0000_init`), the rules in `lib/auth/` (passwords, tokens, rate limits, sessions, sign-up, verify, reset, credentials check), `auth.ts`, `proxy.ts`, the five pages under `app/(auth)/`, the layout check, the sidebar account and log out, and tests for all of it.

**Tested.** `tsc` is clean, `next build` works, and 137 `vitest` tests pass against an in-memory Postgres. The running app was also driven over HTTP against a real local Postgres. Checked: sign-in sets the cookie and creates one `auth_sessions` row; log out deletes the row and the old cookie then redirects to `/login`; deleting the row on the server kills a still-valid cookie; wrong password and unknown email give the same answer; an unverified account is refused with `email_not_verified`; the sixth try is blocked; sign-up, the duplicate-address warning, the confirm button, forgot and reset all work through the real forms; pages are sent with `no-store`; the social buttons redirect to Google and Microsoft with the right callback address and the `openid profile email` scope.

Not done, because it needs accounts or a real browser:
- Google Cloud and Microsoft Entra setup, the Resend domain, and a shared Neon branch (step 1). The HTTP run used a local Postgres and printed emails in the terminal.
- A real sign-in with each provider, and a real email in Gmail and Outlook.
- Browser tests that click through the forms with JavaScript on (the HTTP run posted the same forms the way a browser without JavaScript does), and a check of the `pageshow` back-button reload.
- Running the migrations on the shared Neon database: `npm run db:migrate` in `web/` with `DATABASE_URL_UNPOOLED` set. `0001_login.sql` makes `users.email` required, so it fails if that database already holds a user with no email.
- GitHub issues for the five **New** rows, and the teammate review of US-01.

Where the code differs from the plan below:
- The database client is the Neon branch's `node-postgres` pool in `db/index.ts`. The `Db` type is any Drizzle Postgres database, so the rules also run on PGlite in tests.
- The link in the verification email opens a page with a "Verify my email" button. The button, not the page load, uses the link, so an email scanner that opens links can't use it up.
- Logged-out API calls get a `401` with no body from `proxy.ts`, not a redirect. Pages redirect to `/login?from=...`. `/api/health` is the one API route open to logged-out callers.
- Email tokens are found by their SHA-256 hash, so a plain database lookup replaces a constant-time compare. The token is 32 random bytes, so the hash can't be guessed bit by bit.
- A new sign-up for an email that nobody has verified replaces the older, unverified one. This closes the pre-hijack gap from the other side, next to the guard for Google and Microsoft.
- `AUTH_URL` is a new environment variable. It sets the address in email links.

## What the user sees

| Screen | What it does |
| --- | --- |
| `/signup` | "Continue with Google", "Continue with Microsoft", an "or" divider, then name, email and password. A link to `/login` |
| `/login` | The same two buttons, then email and password. "Forgot password?" and a link to `/signup` |
| `/verify-email` | "Check your inbox" with the address shown and a "Resend email" button. Resend waits 60 seconds between sends |
| `/forgot-password` | One email field. It always shows the same "If that address has an account, we sent a link" message |
| `/reset-password` | Reached from the email link. Two fields for the new password. On success it goes to `/login` |

Details most modern apps share, and Atlas copies:
- A show/hide toggle on every password field.
- A live strength hint on sign-up, not a list of required symbols.
- The right `autocomplete` values (`email`, `current-password`, `new-password`), so password managers work.
- The first field is focused on page load, and Enter submits the form.
- Buttons show a busy state and can't be pressed twice.
- Signing up with email sends a verification link, and the user can't enter the app until they click it. Social sign-ups skip this, since Google and Microsoft have already checked the address.
- After verification the user lands on Today.

## The issues

All are Must, in the Phase 0: Foundation milestone. Rows marked **New** need a GitHub issue created.

| Issue | What it asks for |
| --- | --- |
| #47 | Write the user story. It now covers sign up, sign in, reset and log out |
| #48 | Sign in with Google. The first login creates my account and later ones reuse it. Identity only, no calendar access. Land on Today |
| #49 | Add Google sign-in. Done when signing in creates a user in the database |
| #50 | Sign in with Microsoft. Same as Google, and works with personal and Microsoft 365 accounts |
| #51 | A cancelled or failed sign-in returns to the login page with a readable message and a retry. No technical details or tokens in the UI or URL |
| #52 | Logged-out visitors are sent to login from every page and API route, then back to the page they asked for. A signed-in user who opens the login or sign-up page goes to Today |
| #210 | The session survives a refresh and a browser restart. Log out ends it on the server. The back button shows nothing private afterwards. Cookies are HTTP-only |
| **New** | Sign up with email and password. Creates an unverified account and sends a verification email |
| **New** | Verify email. The link verifies the account, signs the user in and goes to Today. Expired links offer a new one |
| **New** | Log in with email and password. Unverified accounts can't enter and are offered a new verification email |
| **New** | Forgot and reset password. The link works once and expires in 1 hour. Resetting signs out every other session |
| **New** | Abuse limits. Rate limits on sign-in, sign-up, resend and reset. Messages that don't reveal whether an email has an account |

## How it fits together

```
Browser                 Next.js on Vercel                    Google / Microsoft
  |  "Continue with X"     |                                     |
  |----------------------->|  Auth.js builds the sign-in request  |
  |<-----------------------|  (state, PKCE, identity scopes)      |
  |------------------------------------------------------------->|  user signs in
  |<-------------------------------------------------------------|  back to /api/auth/callback/x
  |----------------------->|  Auth.js checks the response,        |
  |                        |  finds or creates the user (Neon),   |
  |                        |  saves a session row                 |
  |<-----------------------|  HTTP-only session cookie, go to Today
```

Email and password skips the provider. Atlas's own sign-up code hashes the password, writes the user and sends the verification email through Resend. Auth.js's Credentials provider then handles the log in step:

```
Sign up:   form --> user row (unverified) --> email with link --> /verify-email?token=... --> session --> Today
Log in:    form --> Credentials check --> verified? --> session row + cookie --> Today
Reset:     email --> link (1 hour, one use) --> new password --> other sessions deleted --> /login
```

### Server-side sessions on top of JWT

#210 says log out must end the session on the server. Auth.js's database session strategy does that, but it doesn't work for password logins, because the Credentials provider only supports JWT sessions. So Atlas uses the JWT strategy for every login method, and adds its own check:

- On sign-in, the `jwt` callback inserts a row in `auth_sessions` and puts its id (`sid`) in the token.
- On every `auth()` call, the same callback looks up that row. If it is missing or expired, it returns `null`, and Auth.js treats the visitor as logged out.
- Log out and "reset password" delete the rows. A stolen or copied cookie stops working at once, which meets #210.
- The cost is one small Neon query per request, the same as the database strategy.

Check this against the pinned `next-auth` version in step 2. The `null` return from the `jwt` callback is the part to test first.

### Tables

The Auth.js Drizzle adapter creates the first three. Atlas adds the last three.

| Table | Holds |
| --- | --- |
| `users` | The Auth.js users table, plus Atlas's own `time_zone` and `password_hash` columns. `password_hash` is empty for Google and Microsoft users |
| `accounts` | One row per Google or Microsoft identity. Separate from `connected_accounts`, which holds calendar connections |
| `verification_tokens` | Required by the adapter. Unused, since Atlas keeps its own token table |
| `auth_sessions` | **New.** One row per signed-in browser, with its expiry, IP address and user agent |
| `email_tokens` | **New.** Verification and reset links: the token's hash (never the token), user id, purpose, expiry and used-at |
| `rate_limits` | **New.** Counters by key (email or IP address plus action) and time window |

**Passwords:** hash with Node's built-in `scrypt` and a random salt per user, so there is no extra dependency. Never store or log the plain password. Accept 8 to 128 characters with no forced symbols. Reject passwords found in a bundled common-password list.

**Tokens in email links:** create 32 random bytes, email the token, and store only its SHA-256 hash. Look the token up by its hash, and use it with one `UPDATE`, so two clicks at the same moment can't both succeed.

**Don't store sign-in tokens.** By default Auth.js copies the provider's access and refresh tokens into `accounts` as plain text. Sign-in only needs to know who the user is, so wrap the adapter's `linkAccount` to drop those fields before saving (F-40). Calendar tokens are a separate, encrypted concern in the sync plan.

### Same email, several sign-in methods

One person may sign up with a password and later press "Continue with Google" with the same address. Keep the Auth.js default: it refuses to join the two (`OAuthAccountNotLinked`), because Microsoft doesn't always verify personal addresses. The user sees "This email already uses another sign-in. Use the one you chose first." Linking from Settings can come later.

**Pre-hijack guard:** an attacker could sign up with a victim's email and their own password before the victim does. The victim's Google sign-in would then be blocked by the rule above. To prevent this, the `signIn` callback for Google and Microsoft checks for a user with the same email whose email is **unverified** and who has no provider account. If it finds one, it deletes that user so the real owner can sign in. Unverified accounts can't enter the app, so the attacker never gets in. Confirm in step 3 that this callback runs before Auth.js looks up the user.

### Protecting pages and API routes (#52)

Check the session in three places, and don't rely on the first one alone:

1. **The request interceptor** (`proxy.ts` in Next.js 16, `middleware.ts` before that) redirects visitors without a session cookie to `/login?from=/calendar`, and answers API calls with a `401`. This is only a fast first pass for a smoother experience.
2. **The app layout**, `app/(app)/layout.tsx`, reads the session on the server and redirects if there is none, or if the email is unverified. Every page inside the `(app)` group is covered by this one check.
3. **Every API route** calls a shared `requireUser()` helper. It returns the user, or a 401 response with no data. Each database query is scoped to that user's id.

Interceptor checks have been bypassed in Next.js before, so the real check has to live in the layout and in the routes.

The pages `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password` and the auth routes are the only ones reachable while logged out. A signed-in, verified visitor to any of them goes to Today.

The return address (`from`) must be a path inside Atlas, starting with `/` but not `//`. That stops the login page from being used to send people to another site. With no `from`, go to Today. Keep `from` through sign-up and verification.

**Sidebar account:** shows the real name, initials or picture, and a "Log out" item instead of the hard-coded "Abel Tolla".

**First sign-in:** the browser sends its time zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) once, to fill `users.time_zone` (F-37).

## Steps

### 1. Setup (no code)

**Google Cloud project:**
- Every developer is an owner.
- Set up the OAuth consent screen with only `openid`, `email` and `profile`. These scopes don't need Google's app review.
- Create a Web client.

**Microsoft Entra app registration:**
- Create it in one free Azure tenant, and add each teammate as a guest and owner.
- Supported account types: any organizational directory plus personal Microsoft accounts.
- Use the same registration later for calendar connect (sync plan, Part C). Sign-in asks only for `openid`, `email` and `profile`, and calendar permission is asked for separately.

**Resend:**
- Create one account for the team and verify the sending domain (SPF and DKIM records). Without this, verification emails land in spam.
- In development, log the email links to the terminal and send nothing.

**Redirect URIs** for both providers:
- `http://localhost:3000/api/auth/callback/google`
- `http://localhost:3000/api/auth/callback/microsoft-entra-id`
- the same two paths on the production domain

**Vercel environment variables:** `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ISSUER`, `AUTH_URL`, `RESEND_API_KEY`, `EMAIL_FROM` and `DATABASE_URL`. `web/.env.example` lists them all.

### 2. Email and password (new issues)

- Install `next-auth@5` pinned to an exact version, plus `@auth/drizzle-adapter`.
- Add the six tables above to the Drizzle schema and migrate the Neon branches.
- Put the config in `auth.ts`: the Drizzle adapter, `session: { strategy: 'jwt' }`, the `jwt` callback that creates and checks the `auth_sessions` row, the Credentials provider, and `pages: { signIn: '/login', error: '/login' }`. Export `auth`, `signIn` and `signOut`. Add the route handler at `app/api/auth/[...nextauth]/route.ts`.
- The Credentials `authorize` function reads the user, compares the password hash in constant time, and returns `null` on any failure. Run the comparison even when the user doesn't exist, so the response time doesn't reveal it. For an unverified user, throw a `CredentialsSignin` error with the code `email_not_verified`, so the login page can offer a new email.
- Write the server actions `signUp`, `verifyEmail`, `resendVerification`, `requestPasswordReset` and `resetPassword`, each with its own input check and rate limit. Sending goes through Resend.
- Build `/signup`, `/login`, `/verify-email`, `/forgot-password` and `/reset-password` in the existing design style.
- Set the reset link to expire in 1 hour. After a reset, delete every `auth_sessions` row for that user.
- **Done when:** signing up sends an email, the link verifies the account, and an unverified account can't log in. Resetting a password ends the old sessions.

### 3. Google (#49, #48)

- Add the Google provider, and the `linkAccount` wrapper that drops provider tokens.
- Add the `signIn` callback with the pre-hijack guard.
- **Done when:** signing in creates a `users` row and an `accounts` row with no tokens in it. Signing in again reuses them.

### 4. Microsoft (#50)

- Add the Microsoft Entra ID provider, using the `common` endpoint so both personal and Microsoft 365 accounts work.
- Test early with one personal Outlook account and one school account. Multi-tenant sign-in is the part most likely to need a config fix, because each school's tokens name their own tenant.
- Apply the same-email rules above.

### 5. Errors and abuse limits (#51, new issue)

Auth.js sends errors back to `/login?error=<Code>` (and `code=<reason>` for password logins). The codes are short words, never tokens. Map each to a message, with a retry that starts the same method again:

| Case | Message |
| --- | --- |
| Provider sign-in cancelled | You cancelled sign-in. Nothing was saved. |
| Wrong email or password, or no such account | Incorrect email or password. (One message for both, so nobody can find out which emails have accounts.) |
| Email not verified | Check your inbox to verify your email. [Send it again] |
| Email already has a different sign-in method | This email already uses another sign-in. Use the one you chose first. |
| Sign-up with an email that has an account | Show "Check your inbox" as for a new account, and email the owner that someone tried to sign up. |
| Password too short or on the common list | Use at least 8 characters and avoid common passwords. |
| Verify or reset link expired or used | This link has expired. [Send a new one] |
| Too many attempts | Too many tries. Wait a few minutes and try again. |
| Provider didn’t answer as expected | Google or Microsoft didn’t answer as expected. Try again. |
| Anything unknown | Sign-in isn’t working right now. Try again in a minute. |

Rate limits (Auth.js has none, so use the `rate_limits` table in Neon, because Vercel functions share no memory; call the check at the top of `authorize` and of each server action): 5 sign-in attempts per email per 15 minutes, 5 sign-ups and 3 reset or resend emails per address per hour, plus an overall limit per IP address.

Remove the error parameter from the address bar once the message shows.

### 6. Protect pages and API routes (#52)

- Add the request interceptor, the `(app)` layout check and `requireUser()`, as described above.
- Move every app page into the `(app)` route group, and add `requireUser()` to every API route as it is written. The sync plan's routes all start with it.

### 7. Sessions and log out (#210)

- **Expiry:** 30 days, refreshed while the user is active. The `auth_sessions` row has the same expiry. The cookie is HTTP-only, `Secure` in production and `SameSite=Lax`.
- **Log out:** calls `signOut({ redirectTo: '/login' })`. The `signOut` event deletes the `auth_sessions` row named in the token, so the old cookie stops working at once.
- **Back button:** app pages are rendered fresh on every request and sent with `Cache-Control: no-store`. A small `pageshow` listener also reloads any page the browser restores from its back-forward cache after logout, which then lands on `/login`.

### 8. User story (#47)

US-01 in `User Stories.md` already exists. Rewrite it in the "As a… I want… so that…" form. Add criteria for sign up, email verification, password reset, and the session and log out rules from #210. Have a teammate review it.

## Docs to update

These documents still describe the old plan and need a pass:
- **Done:** F-01 in the PRD and the Feature List, and US-01 in User Stories, now cover sign up, verification and reset. The new work sits inside F-01 and US-01, so no IDs or counts changed. The README and the Planning Pack never mentioned the old rule.
- **Still to do:** a teammate must review US-01 (step 8).
- **Canvas and Microsoft Sync Plan:** it uses Auth.js, `auth()` and `requireUser()`, which still match. Check only that nothing says sessions are database sessions.
- **Storyboards (Deliverable 02):** the Login epic has no sign-up or reset storyboards. Add them.

## Testing

**Unit tests (Vitest):**
- the error-case-to-message map
- the check on the return address
- the password rules (length limits, common-password list) and the hash and compare functions
- the token helper: only the hash is stored, and used or expired tokens are refused
- `requireUser()` returning 401 without a session

**Written and passing:** the unit and database tests in `web/src/lib/auth/*.test.ts` and `web/src/proxy.test.ts`. They run the real migration on PGlite (an in-memory Postgres) with a fake mailer. They cover the message map, the return address, passwords, tokens, rate limits, sessions, sign-up, verification, duplicate sign-ups, reset, the sixth-try block, the Google guard, `requireUser()` and the proxy. The list below is the browser-level plan and is **not written yet**.

**Real Google and Microsoft sign-in can't run in automated tests**, because the providers block robots. End-to-end tests instead use email and password for real, with Resend replaced by a test inbox that records the links, and put session rows straight into a test Neon branch where a flow needs one. With that, test that:
- sign up, verify by link, then land on Today
- an unverified account can't log in and can ask for a new link
- sign-up with an existing email shows the same screen and reveals nothing
- forgot password, reset, and the old password and old sessions stop working
- the sixth wrong password in a row is blocked
- protected pages redirect when logged out and load when logged in
- `from` brings you back to the right page, including after sign-up
- log out deletes the row, and the old cookie no longer works

**Manual checks before closing the epic:**
- Google sign-in, Microsoft personal sign-in and Microsoft school sign-in on the deployed site
- cancelling at each provider
- a real verification email and a real reset email, in Gmail and Outlook, not in spam
- a password manager fills and saves both the sign-up and login forms
- sign up with a password, then Google with the same address
- log out, then the back button

## Order

| Step | Work | Notes |
| --- | --- | --- |
| 0 | Move to Next.js, Neon and Drizzle set up | From the sync plan. Everything waits on this |
| 1 | Provider, Resend and env vars | No code, can run during step 0. Domain checks for Resend take time, so start early |
| 2 | Email and password, verification, reset | First end-to-end sign-up |
| 3 | Google sign-in (#49, #48) | Parallel with 4 once 2 lands |
| 4 | Microsoft sign-in (#50) | |
| 5 | Error messages and abuse limits (#51) | |
| 6 | Protect pages and API routes (#52) | |
| 7 | Sessions, log out, back button (#210) | |
| any | User story (#47), docs to update | |

**Done when** (from the epic):
- A new user can sign up with an email and password, verify the address and land on Today.
- A user can sign in with a password, Google or Microsoft on the deployed site and land on Today.
- A user who forgot a password can reset it by email.
- A logged-out or unverified visitor can't reach any app page or API route.
- A failed sign-in shows a clear error, and logging out ends the session on the server.

## Not in this epic

These are common in modern apps and can be added later. Each one is more code to write on Auth.js:
- two-factor sign-in and passkeys
- magic-link ("email me a link") sign-in
- Apple and GitHub sign-in
- change email, change password and delete account in Settings
- linking a second provider from Settings

## Risks

| Risk | Mitigation |
| --- | --- |
| Auth.js v5 has been in beta for a long time, and the project is now maintained by the Better Auth team | Pin an exact version and keep all Auth.js code in `auth.ts` and the route handler, so a later switch touches few files |
| Atlas writes its own sign-up, verification, reset and rate-limit code, which is security-sensitive and Auth.js does not check it | Keep it in one folder (`lib/auth/`), write the unit and end-to-end tests below, and have a second developer review every change in it |
| The `jwt` callback session check does not work as expected in the pinned version | Test the `null` return and the log out case first in step 2, before building the forms. If it fails, the fallback is a manual session cookie for password logins only |
| Verification and reset emails go to spam | Verify the Resend domain with SPF and DKIM, test in Gmail and Outlook before closing the epic |
| Attackers guess passwords or reuse leaked ones | Rate limits, the common-password list, and one message for every bad login |
| Someone finds which emails have accounts | Same message and same screen for sign-up, login and reset whether the account exists or not |
| Someone signs up with a victim's email before the victim does | Unverified accounts can't enter the app, and the pre-hijack guard in the linking rules |
| A reset or verification link is stolen | Links expire (1 hour for reset), work once, and a reset signs out every other session |
| Microsoft multi-tenant sign-in fails for some school accounts | Test a personal and a school account in step 4, before building on it |
| A work or school Microsoft tenant can send an email address that nobody verified, and Auth.js marks every provider account as verified | Not fixed in the code. The same-email rule stops a Microsoft login from joining an existing account, but it can still create a new account with someone else's address. Before launch, read Microsoft's optional `xms_edov` claim or limit Microsoft sign-in to personal accounts |
| Vercel preview URLs change per deploy, so OAuth redirects don't match | Test sign-in on localhost and production only, or add one fixed preview domain to both providers |
| Rate limits stored in memory don't work across Vercel functions | Store the counters in Neon |
| A protected route forgets `requireUser()` | Put a check in code review, and add a test that calls every API route without a session and expects 401 |
| The change adds scope to a Must epic | The new issues are all Must for Phase 0. If time is short, Google and Microsoft can ship first, since they need no email setup |
