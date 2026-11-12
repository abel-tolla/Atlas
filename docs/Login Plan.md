# Login Plan

This plan covers the Login epic (#7): signing in with Google or Microsoft, keeping every page behind sign-in, and sessions with log out. Atlas has no email and password accounts (F-01), so there is no sign-up form, password reset or email verification. Every other feature needs to know who the user is, so this epic comes first.

**Decisions made:** Next.js (App Router), Auth.js, Postgres on Neon with Drizzle, hosting on Vercel. The developers jointly own every service. The move to Next.js is described in [Canvas and Microsoft Sync Plan.md](Canvas%20and%20Microsoft%20Sync%20Plan.md#moving-to-nextjs) and has to happen first.

## The issues

All are Must, in the Phase 0: Foundation milestone.

| Issue | What it asks for |
| --- | --- |
| #47 | Write the user story |
| #48 | Sign in with Google. The first login creates my account and later ones reuse it. Identity only, no calendar access. Land on Today |
| #49 | Add Google sign-in. Done when signing in creates a user in the database |
| #50 | Sign in with Microsoft. Same as Google, and works with personal and Microsoft 365 accounts |
| #51 | A cancelled or failed sign-in returns to the login page with a readable message and a retry. No technical details or tokens in the UI or URL |
| #52 | Logged-out visitors are sent to login from every page and API route, then back to the page they asked for. A signed-in user who opens the login page goes to Today |
| #210 | The session survives a refresh and a browser restart. Log out ends it on the server. The back button shows nothing private afterwards. Cookies are HTTP-only |

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

### Database sessions, not JWTs

#210 says log out must end the session on the server. With Auth.js's database session strategy, each session is a row in Neon. Logging out deletes the row, so a stolen or copied cookie stops working at once. A JWT session can't be cancelled before it expires, so it doesn't meet #210.

### Tables

The tables come from the Auth.js Drizzle adapter:

| Table | Holds |
| --- | --- |
| `users` | The Auth.js users table, plus Atlas's own `time_zone` column |
| `accounts` | One row per sign-in identity (Google or Microsoft). Separate from `connected_accounts`, which holds calendar connections |
| `sessions` | One row per signed-in browser, with its expiry |
| `verification_tokens` | Required by the adapter. Unused, since there are no email links |

**Don't store sign-in tokens.** By default Auth.js copies the provider's access and refresh tokens into `accounts` as plain text. Sign-in only needs to know who the user is, so wrap the adapter's `linkAccount` to drop those fields before saving (F-40). Calendar tokens are a separate, encrypted concern in the sync plan.

### Protecting pages and API routes (#52)

Check the session in three places, and don't rely on the first one alone:

1. **The request interceptor** (`proxy.ts` in Next.js 16, `middleware.ts` before that) redirects visitors without a session cookie to `/login?from=/calendar`. This is only a fast first pass for a smoother experience.
2. **The app layout**, `app/(app)/layout.tsx`, calls `auth()` and redirects if there is no valid session. Every page inside the `(app)` group is covered by this one check.
3. **Every API route** calls a shared `requireUser()` helper. It returns the user, or a 401 response with no data. Each database query is scoped to that user's id.

Interceptor checks have been bypassed in Next.js before, so the real check has to live in the layout and in the routes.

The return address (`from`) must be a path inside Atlas, starting with `/` but not `//`. That stops the login page from being used to send people to another site. With no `from`, go to Today.

### Pages

**`/login`:**
- The Atlas logo and two buttons, "Continue with Google" and "Continue with Microsoft", in the existing design style.
- It is the only page reachable while logged out, apart from Auth.js's own routes.
- A signed-in visitor goes straight to Today.

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

**Redirect URIs** for both providers:
- `http://localhost:3000/api/auth/callback/google`
- `http://localhost:3000/api/auth/callback/microsoft-entra-id`
- the same two paths on the production domain

**Vercel environment variables:** `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ISSUER` and `DATABASE_URL`.

### 2. Auth.js with Google (#49, #48)

- Install `next-auth@5` pinned to an exact version, plus `@auth/drizzle-adapter`.
- Add the four tables above to the Drizzle schema and migrate the Neon branches.
- Put the config in `auth.ts`: the Google provider, the Drizzle adapter, `session: { strategy: 'database' }`, and `pages: { signIn: '/login', error: '/login' }`. Export `auth`, `signIn` and `signOut`.
- Add the route handler at `app/api/auth/[...nextauth]/route.ts`.
- **Done when:** signing in creates a `users` row and an `accounts` row with no tokens in it. Signing in again reuses them.

### 3. Microsoft (#50)

- Add the Microsoft Entra ID provider, using the `common` endpoint so both personal and Microsoft 365 accounts work.
- Test early with one personal Outlook account and one school account. Multi-tenant sign-in is the part most likely to need a config fix, because each school's tokens name their own tenant.
- **Same person, two providers:** by default Auth.js refuses to join a Google login and a Microsoft login that share an email (`OAuthAccountNotLinked`). Keep that default, since Microsoft doesn't always verify personal email addresses. Instead, show "You first signed in with Google. Use Google to continue." Linking accounts from Settings can come later.

### 4. Failed or cancelled sign-in (#51)

Auth.js sends errors back to `/login?error=<Code>`. The code is a short word, never a token. Map each to a message, with a retry button that starts the same provider again:

| Code | Message |
| --- | --- |
| `AccessDenied` | You cancelled sign-in. Nothing was saved. |
| `OAuthAccountNotLinked` | This email already uses another sign-in. Use the one you chose first. |
| `OAuthCallbackError`, `OAuthSignin`, `Callback` | Google or Microsoft didn’t answer as expected. Try again. |
| `Configuration` and anything unknown | Sign-in isn’t working right now. Try again in a minute. |

Remove the `error` parameter from the address bar once the message shows.

### 5. Protect pages and API routes (#52)

- Add the request interceptor, the `(app)` layout check and `requireUser()`, as described above.
- Move every app page into the `(app)` route group, and add `requireUser()` to every API route as it is written. The sync plan's routes all start with it.

### 6. Sessions and log out (#210)

- **Expiry:** Auth.js defaults to 30 days, refreshed while the user is active. The cookie is HTTP-only, `Secure` in production and `SameSite=Lax`.
- **Log out:** calls `signOut({ redirectTo: '/login' })`, which deletes the session row.
- **Back button:** app pages are rendered fresh on every request and sent with `Cache-Control: no-store`. A small `pageshow` listener also reloads any page the browser restores from its back-forward cache after logout, which then lands on `/login`.

### 7. User story (#47)

US-01 in `User Stories.md` already exists. Rewrite it in the "As a… I want… so that…" form, adding the session and log out criteria from #210, and have a teammate review it.

## Testing

**Unit tests (Vitest):**
- the error-code-to-message map
- the check on the return address
- `requireUser()` returning 401 without a session

**Real sign-in can't run in automated tests**, because Google and Microsoft block robots. End-to-end tests instead put a session row straight into a test Neon branch and set the matching cookie. With that, test that:
- protected pages redirect when logged out and load when logged in
- `from` brings you back to the right page
- log out deletes the row, and the old cookie no longer works

**Manual checks before closing the epic:**
- Google sign-in, Microsoft personal sign-in and Microsoft school sign-in on the deployed site
- cancelling at each provider
- log out, then the back button

## Order

| Step | Work | Notes |
| --- | --- | --- |
| 0 | Move to Next.js, Neon and Drizzle set up | From the sync plan. Everything waits on this |
| 1 | Provider setup and env vars | No code, can run during step 0 |
| 2 | Google sign-in (#49, #48) | First end-to-end sign-in |
| 3 | Microsoft sign-in (#50) | Parallel with steps 4 and 5 once 2 lands |
| 4 | Error messages (#51) | |
| 5 | Protect pages and API routes (#52) | |
| 6 | Sessions, log out, back button (#210) | |
| any | User story (#47) | |

**Done when** (from the epic):
- A user can sign in with Google or Microsoft on the deployed site and land on Today.
- A logged-out visitor can't reach any app page or API route.
- A failed sign-in shows a clear error, and logging out ends the session on the server.

## Risks

| Risk | Mitigation |
| --- | --- |
| Auth.js v5 has been in beta for a long time, and the project is now maintained by the Better Auth team | Pin an exact version and keep all Auth.js code in `auth.ts` and the route handler, so a later switch touches few files |
| Microsoft multi-tenant sign-in fails for some school accounts | Test a personal and a school account in step 3, before building on it |
| Vercel preview URLs change per deploy, so OAuth redirects don't match | Test sign-in on localhost and production only, or add one fixed preview domain to both providers |
| The same person signs in with both providers | Keep linking off and show the message in step 4. Revisit with a linking option in Settings |
| A protected route forgets `requireUser()` | Put a check in code review, and add a test that calls every API route without a session and expects 401 |
