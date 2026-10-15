# Atlas

## Project Description
A calendar web app, that combines calendars from google calendar, microsft teams, canvas, apple calendar all into one. We also have AI element that helps schedule new tasks and help you answer any questions about your scheduele. Ideally the AI has context of your schedule. The app will combine calendars from Google Calendar, Microsoft Teams, Canvas, and Apple Calendar into one unified calendar, allowing users to view their classes, meetings, assignments, appointments, and personal events in one place. An AI assistant will have context of the user's schedule and help them plan their time, answer questions about their schedule, find available time slots, create and reschedule events, and automatically break larger tasks and deadlines into manageable study or work sessions. The app will also detect scheduling conflicts, identify upcoming deadlines and tasks that may be at risk, recommend how users should prioritize their time, and optimize their schedules based on their preferences, availability, and workload. Users will be able to create tasks and goals and ask the AI questions such as "What should I work on right now?" or "Can I finish this assignment before Friday?" The app will also provide weekly schedule summaries and recommendations to help users improve their time management. Finally, users will have the ability to receive notifications through text messages and email for upcoming events, deadlines, reminders, schedule changes, and other important updates, allowing them to stay informed even when they are not actively using the app.

Ideally the user connects there microsft, google, apple, canvas accounts and we use the api to get infromation about there calendar then propagate it into our database which our website will get its information from.

## Product Requirements Document
# Project Requirements Document (PRD): Atlas - Unified Intelligent Calendar

## 1. Executive Summary & Project Overview

### 1.1 Project Description
Atlas is a centralized, AI-powered calendar web application designed to eliminate calendar fragmentation. By seamlessly aggregating schedules from Google Calendar, Microsoft Teams/Outlook, Canvas LMS, and Apple Calendar (CalDAV), Atlas provides users with a single, unified source of truth for all classes, meetings, assignments, appointments, and personal events. Beyond mere aggregation, Atlas features a deeply integrated, self-hosted AI assistant that maintains context of the user's schedule, proactively detects conflicts, identifies at-risk deadlines, and optimizes time management through intelligent task planning and automated scheduling.

### 1.2 Target Audience & Personas
- **Students:** Balancing heavy course loads, rolling Canvas assignment deadlines, study groups, and extracurricular commitments.
- **Working Professionals:** Managing back-to-back meetings across multiple workplace calendars (e.g., Google Workspace, Microsoft 365) alongside personal appointments.
- **Busy Individuals:** Anyone struggling to maintain a healthy work-life balance due to disconnected schedules and the cognitive overhead of manual calendar management.
- **Core Pain Points Addressed:** Schedule fragmentation, manual entry fatigue, missed deadlines due to overlapping commitments, and the lack of proactive time-management guidance.

### 1.3 Core Objectives & MVP Scope (4–6 Week Timeline)
- **Unified Interface:** A clean, responsive Next.js web application displaying a consolidated calendar view with priority-based conflict management.
- **Multi-Source Ingestion:** Secure OAuth 2.0 integration with at least two external calendar sources (Google, Microsoft, Canvas, or Apple/CalDAV) for the MVP.
- **Intelligent Sidebar Assistant:** An interactive, self-hosted AI chat interface (powered by Ollama) capable of reading user schedules, answering temporal queries, and performing basic CRUD operations on tasks.
- **Cost-Free Infrastructure Philosophy:** Leveraging free-tier cloud services (Vercel, Neon PostgreSQL, Resend) and self-hosted open-source models to keep development and operating expenses at zero during the MVP stage.

---

## 2. Product Architecture & Tech Stack

### 2.1 Technology Stack Selection
- **Frontend & Backend Framework:** Next.js with TypeScript (Monorepo architecture combining UI components and backend API routes).
- **Database & Hosting:** PostgreSQL hosted on Neon or Supabase (utilizing generous free tiers).
- **Authentication & Security:** Auth.js handling OAuth 2.0 flows for Google, Microsoft, and other providers with encrypted token storage.
- **AI & LLM Engine:** Self-hosted open-source model (e.g., Llama or Qwen) executed via Ollama to eliminate per-request API costs.
- **External Integrations:** Google Calendar API, Microsoft Graph API, Canvas API, and CalDAV standard protocols.
- **Notifications (Post-MVP / Limited MVP):** Resend for transactional email notifications; SMS incorporated via limited free tiers or marked as optional for initial rollouts.
- **Deployment Platform:** Vercel for Next.js app deployment, coupled with Neon for database persistence.

### 2.2 Database Schema Design
The relational PostgreSQL schema separates external calendar entities from internal user-generated tasks, goals, and AI-driven sessions:
- **`users` Table:** Stores account metadata, settings, and encrypted credentials.
- **`connected_accounts` Table:** Tracks external provider metadata, OAuth tokens (encrypted), and sync timestamps.
- **`calendars` Table:** Represents individual calendars associated with each connected account.
- **`events` Table (Unified):** Stores centralized event data with fields for `user_id`, `calendar_id`, `external_event_id`, `title`, `start_time`, `end_time`, `location`, `priority`, and `event_type`.
- **`tasks_and_goals` Table:** Internal entities representing user-defined deliverables, deadlines, and target workloads.
- **`ai_sessions` Table:** AI-generated study or work blocks linked directly to internal tasks to track progress.
- **`user_preferences` Table:** Working hours, notification rules, and custom scheduling weights.

---

## 3. Detailed Functional Requirements

### 3.1 Unified Calendar & Multi-Source Synchronization
- **REQ-CAL-01 (Aggregation):** The system must ingest events from Google Calendar, Microsoft Graph, Canvas LMS, and Apple Calendar (via CalDAV) into a single, cohesive view.
- **REQ-CAL-02 (Sync Mechanisms):** 
  - Automated daily background synchronization for all connected accounts.
  - Webhook/push notification support (where provided by Google and Microsoft) for real-time event updates.
  - Manual "Sync Now" button featuring strict rate limiting and cooldown periods to prevent API flooding and race conditions.
- **REQ-CAL-03 (Conflict Resolution & Priority Engine):**
  - Automatic identification of overlapping events.
  - Priority hierarchy: Work/school commitments carry higher default priority than routine personal events; user-flagged vital events (weddings, medical appointments) take precedence.
  - Manual override capability allowing users to adjust event priority weights via the UI.
  - Visual conflict indicators highlighting overlaps with AI-driven recommendations for rescheduling.

### 3.2 AI Assistant & Scheduling Engine
- **REQ-AI-01 (Context-Aware Chat):** An accessible, persistent sidebar chat interface embedded within the calendar UI.
- **REQ-AI-02 (Token & Context Management):** The system must avoid transmitting the user's entire calendar to the LLM. Instead, structured database queries retrieve only relevant date ranges and event subsets based on user prompts.
- **REQ-AI-03 (Tool Calling & Actions):** The self-hosted LLM (Ollama) must utilize a tool-calling architecture to execute functions such as:
  - `get_schedule(date_range)`
  - `find_available_slots(duration, deadline)`
  - `create_event(title, start, end)`
  - `reschedule_event(event_id, new_start, new_end)`
  - `break_down_task(task_id)`
- **REQ-AI-04 (Natural Language Interactions):** Users must be able to query the assistant with prompts like "What should I work on right now?", "When am I free this week?", or "Can I finish this assignment before Friday?" and receive deterministic, actionable scheduling guidance.

### 3.3 Task Management & Intelligent Breakdown
- **REQ-TSK-01 (Task Creation):** Users can define standalone tasks, assign target completion dates, and tag them with priority levels.
- **REQ-TSK-02 (Automatic Session Generation):** The AI assistant can automatically decompose large deliverables and deadlines into manageable, scheduled study or work blocks distributed across the user's available free time.

### 3.4 Notifications & Summaries (Phase 2 / Post-MVP)
- **REQ-NOT-01 (Granular Control):** Users must have full control over notification channels (Email, SMS, In-App) and timing preferences.
- **REQ-NOT-02 (Quiet Hours):** Support for configured quiet hours during which non-urgent notifications are suppressed.
- **REQ-NOT-03 (Automated Debriefs):** Scheduled daily morning text/email debriefs, evening review summaries, and customizable weekly schedule overviews generated by the AI based on upcoming priorities.

---

## 4. Non-Functional Requirements & Constraints

### 4.1 Data Security & Privacy
- **SEC-01 (Encryption):** All data in transit must be secured using TLS 1.2/1.3. Data at rest must utilize robust encryption standards (AES-256).
- **SEC-02 (Token Security):** OAuth access and refresh tokens must be encrypted before database storage and never exposed to the client-side UI.
- **SEC-03 (Least Privilege):** Calendar integrations must request only the minimum required OAuth scopes necessary for core functionality.
- **SEC-04 (AI Privacy Compliance):** Calendar data fetched for AI interactions must be treated ephemerally. Context passed to local LLM instances must not be persisted into long-term model weights or conversation logs beyond the active session.
- **SEC-05 (User Data Control):** Users must retain the absolute right to disconnect accounts, revoke API tokens, purge conversation history, and completely delete their account and associated database records.
- **SEC-06 (Compliance Alignment):** System architecture must maintain structural alignment with FERPA guidelines for academic data ingested from Canvas, alongside baseline GDPR privacy principles.

### 4.2 Performance & Scalability Benchmarks (MVP Scope)
- **PERF-01 (Concurrent Load):** Designed to support an initial cohort of 20–50 concurrent testing users during MVP validation.
- **PERF-02 (Query Latency):** Common calendar range queries and conflict detection routines must execute in under 1 second under normal database indexing conditions.
- **PERF-03 (Sync Speed):** External calendar synchronization routines must complete within 5–10 seconds, subject to external API rate limits and response times.
- **PERF-04 (AI Responsiveness):** Typical AI assistant chat queries should return an initial response within 3–5 seconds using the self-hosted Ollama backend.

---

## 5. Development Roadmap & Phasing

### 5.1 Phase 1: MVP (Weeks 1–4)
- Core Next.js + TypeScript monorepo setup and PostgreSQL database configuration on Neon.
- Implementation of Auth.js and OAuth 2.0 flows for Google and Microsoft (or Canvas).
- Development of the unified calendar grid UI with priority-based conflict highlighting.
- Integration of self-hosted Ollama model with basic tool-calling for schedule querying and task CRUD operations.

### 5.2 Phase 2: Enhanced Integrations & AI Refinement (Weeks 5–8)
- Integration of remaining calendar providers (Apple CalDAV, Canvas LMS).
- Implementation of webhook listeners for real-time synchronization updates.
- Advanced AI task-breaking algorithms and natural language rescheduling prompts.

### 5.3 Phase 3: Notifications, Summaries & Polish (Post-MVP)
- Integration of Resend email delivery and SMS notification pipelines.
- Implementation of user-defined quiet hours, morning debriefs, and weekly AI summaries.
- Comprehensive user testing, performance optimization, and UI/UX refinement.

## Technology Stack
# Tech Stack: Atlas

## 1. Overview & Architectural Philosophy

Atlas is designed with a strict guiding principle for its initial MVP and development phase: **zero to minimal operational cost**, high data privacy, and minimal third-party service dependencies. 

To achieve this, the architecture uses a **monolithic Next.js application** that combines frontend and backend API logic into a single deployment pipeline. This eliminates the complexity of managing separate microservices while maintaining high developer velocity. The application targets a 4-6 week MVP timeline, emphasizing free-tier cloud infrastructure, open-source self-hosted AI, and robust relational data structures.

---

## 2. Core Technology Stack

| Layer | Recommended Technology | Justification |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js (React) with TypeScript** | Combines UI rendering and server-side API routes in a single codebase. TypeScript ensures type safety across database queries, API payloads, and UI components. |
| **Styling & UI Library** | **Tailwind CSS + Shadcn/UI** | Enables rapid development of clean, accessible, and responsive user interfaces with zero runtime overhead and highly customizable components. |
| **Backend / API** | **Next.js API Routes / Server Actions** | Eliminates the need for a separate backend server (like Express or NestJS), streamlining deployment to serverless environments and keeping operational costs at \$0. |
| **Database** | **PostgreSQL (via Neon or Supabase)** | Provides robust relational capabilities, indexing for fast time-range queries, and native handling of complex schemas. Both providers offer generous free tiers. |
| **Authentication** | **Auth.js (NextAuth.js) & OAuth 2.0** | Securely handles user authentication and session management while natively supporting OAuth 2.0 flows required to connect Google, Microsoft, and other providers. |
| **AI / LLM Engine** | **Ollama (Self-Hosted Open-Source LLM)** | Runs open-source models (e.g., Llama or Qwen) locally or on a cheap self-hosted instance. Avoids per-request token costs associated with OpenAI or Anthropic APIs. |
| **Email Service** | **Resend** | Offers a developer-friendly API and a free tier suitable for transactional emails, reminders, and verification links during the MVP stage. |
| **Hosting & Deployment** | **Vercel** | Optimized natively for Next.js deployments, providing continuous deployment, edge network distribution, and a free hobby tier for the MVP. |

---

## 3. Integration & Sync Infrastructure

To aggregate external schedules without incurring rate-limit blocks or high server overhead, Atlas relies on a hybrid synchronization strategy:

*   **Authentication & Tokens:** OAuth 2.0 protocol for Google Calendar and Microsoft Graph. Refresh tokens are securely encrypted at rest in PostgreSQL, and access tokens are managed dynamically.
*   **APIs & Protocols:** 
    *   Google Calendar API (REST)
    *   Microsoft Graph API (REST)
    *   Canvas LMS API (REST)
    *   Apple Calendar / General feeds via CalDAV protocols where applicable.
*   **Sync Mechanism:** A combination of scheduled daily background tasks, webhook-based push notifications (via Google and Microsoft webhooks), and a user-triggered "Sync Now" button protected by rate-limiting and cooldown logic.

---

## 4. AI & Tool-Calling Architecture

Rather than sending an entire user history or raw calendar dump into an LLM context window (which leads to token overflow and privacy leaks), Atlas uses a **context-retrieval and tool-calling pattern**:

1.  **Structured DB Storage:** All calendar events, user preferences, and tasks are stored relationally in PostgreSQL.
2.  **Intent Parsing:** The self-hosted LLM (via Ollama) acts as the reasoning engine to parse user intents (e.g., "Find me three hours to study before Friday").
3.  **Deterministic Tool Execution:** The LLM does not manipulate dates or schedules directly. Instead, it triggers specific backend functions (e.g., `get_available_slots()`, `create_task()`, `check_conflicts()`) with structured parameters.
4.  **Scoped Context Injection:** Only the relevant date range or specific events requested by the user's prompt are injected into the model context for that specific turn, preserving privacy and staying well within token limits.

---

## 5. Security & Data Protection Stack

*   **Encryption in Transit:** Enforced via TLS 1.2 / 1.3 across all client-server and server-API communications.
*   **Encryption at Rest:** Sensitive credentials, tokens, and personal event details stored in PostgreSQL are protected using AES-256 encryption principles.
*   **Privacy-First Design:** Strict adherence to least-privilege API scopes. Temporary AI context is purged immediately after session completion, and user data is never used to train external or shared model weights.
*   **Compliance Awareness:** Database schemas and data handling routines are built with FERPA principles in mind for student academic data from Canvas, alongside GDPR-aligned account deletion and data export pathways.

---

## 6. Future Scalability & Tech Stack Evolution

While the MVP prioritizes free tiers and a monolithic setup (Vercel + Next.js + Neon + Ollama), the architecture is intentionally decoupled to allow future scaling:
*   **AI Infrastructure Migration:** If self-hosted Ollama instances reach hardware capacity as user volume grows, the abstraction layer allows seamless migration to dedicated cloud-hosted GPU instances or managed LLM endpoints.
*   **Background Workers:** For high-volume automated syncs and complex notification dispatching, future iterations can introduce dedicated background job queues (e.g., BullMQ with Redis).
*   **Database Scaling:** Neon and Supabase allow effortless scaling from free-tier compute instances to production-grade serverless PostgreSQL clusters as user concurrency scales beyond initial testing thresholds (20-50 users).

## Project Structure
# PROJECT STRUCTURE: ATLAS

## 1. Directory Structure Overview

The Atlas project is built as a monolithic Next.js application using TypeScript. It follows the Next.js App Router paradigm, collocating API routes, server actions, and frontend components within a structured directory layout. This structure ensures clear separation of concerns between UI rendering, business logic, AI orchestration, and database interactions while keeping the MVP lightweight and easy to deploy on Vercel.

```
atlas/
├── .env.local
├── .eslintrc.json
├── .gitignore
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── public/
│   ├── favicon.ico
│   └── images/
└── src/
    ├── app/
    │   ├── (auth)/
    │   │   ├── login/
    │   │   └── register/
    │   ├── (dashboard)/
    │   │   ├── calendar/
    │   │   ├── settings/
    │   │   └── tasks/
    │   ├── api/
    │   │   ├── ai/
    │   │   ├── auth/
    │   │   ├── calendar/
    │   │   │   ├── sync/
    │   │   │   └── webhook/
    │   │   └── notifications/
    │   ├── layout.tsx
    │   └── page.tsx
    ├── components/
    │   ├── ai/
    │   ├── calendar/
    │   ├── common/
    │   ├── layout/
    │   └── settings/
    ├── lib/
    │   ├── ai/
    │   │   ├── ollama.ts
    │   │   ├── prompts.ts
    │   │   └── tools.ts
    │   ├── auth/
    │   │   └── auth.ts
    │   ├── db/
    │   │   ├── db.ts
    │   │   ├── migrations/
    │   │   └── schema.ts
    │   ├── integrations/
    │   │   ├── apple.ts
    │   │   ├── canvas.ts
    │   │   ├── google.ts
    │   │   └── microsoft.ts
    │   └── notifications/
    │       ├── email.ts
    │       └── sms.ts
    └── types/
        └── index.ts
```

## 2. Detailed Directory and File Descriptions

### Root Level Files
- **.env.local**: Stores environment variables securely, including database connection strings for Neon/Supabase, Auth.js secrets, OAuth client IDs and secrets for Google, Microsoft, and Canvas, and self-hosted Ollama connection endpoints.
- **next.config.js**: Next.js framework configuration, including experimental flags, image optimization rules, and security headers.
- **package.json**: Project metadata, dependency declarations (Next.js, React, Tailwind CSS, Auth.js, Drizzle/Prisma ORM, PostgreSQL driver), and npm scripts for development, building, and running database migrations.
- **tsconfig.json**: TypeScript compiler configuration, establishing path aliases (e.g., `@/components/*`, `@/lib/*`) for cleaner imports.

### `src/app/` (Next.js App Router)
- **layout.tsx**: Root layout component wrapping the entire application, providing global font settings, CSS imports, and top-level providers (SessionProvider, ThemeProvider).
- **page.tsx**: Landing/Welcome page for unauthenticated users, directing them to login or dashboard views.
- **`(auth)/`**: Route group for authentication screens.
  - `login/page.tsx`: User login interface supporting OAuth providers.
  - `register/page.tsx`: Account creation and onboarding flow.
- **`(dashboard)/`**: Route group for authenticated core application views.
  - `calendar/page.tsx`: Main unified calendar interface displaying aggregated events, tasks, and the persistent AI sidebar.
  - `settings/page.tsx`: User configuration panel for connected accounts, notification preferences, quiet hours, and scheduling rules.
  - `tasks/page.tsx`: Dedicated view for managing internal tasks, goals, and AI-suggested work sessions.
- **`api/`**: Backend API endpoints and webhook handlers.
  - `ai/route.ts`: Endpoint handling chat messages, tool calls, and communication with the self-hosted Ollama LLM instance.
  - `auth/[...nextauth]/route.ts`: Auth.js catch-all route handling OAuth authentication flows and session management.
  - `calendar/sync/route.ts`: Endpoint triggering manual or scheduled synchronization of external calendars.
  - `calendar/webhook/route.ts`: Endpoint receiving real-time push notifications/webhooks from Google Calendar and Microsoft Graph.
  - `notifications/route.ts`: Endpoint managing automated and scheduled email/SMS alerts.

### `src/components/` (React Components)
- **`ai/`**: Components related to the AI assistant.
  - `ChatSidebar.tsx`: Persistent right-side drawer containing the conversational interface.
  - `ChatMessage.tsx`: Individual message bubble supporting markdown rendering and action prompts.
  - `TaskSuggestionCard.tsx`: Interactive card displayed in chat when the AI proposes schedule changes or new tasks.
- **`calendar/`**: Components powering the unified calendar view.
  - `CalendarGrid.tsx`: Main calendar layout supporting day, week, and month views.
  - `EventCard.tsx`: Visual representation of events, styled according to source platform and priority level.
  - `ConflictModal.tsx`: UI alert showing overlapping events with AI-driven resolution recommendations.
- **`common/`**: Reusable UI primitives.
  - `Button.tsx`, `Modal.tsx`, `Dropdown.tsx`, `Badge.tsx`: Design system building blocks styled with Tailwind CSS.
- **`layout/`**: Structural shell components.
  - `Sidebar.tsx`: Navigation sidebar for switching between Calendar, Tasks, and Settings.
  - `Header.tsx`: Top bar displaying user profile, global search, and the manual "Sync Now" button.
- **`settings/`**: Components for managing user configurations.
  - `AccountConnections.tsx`: UI for connecting, disconnecting, and viewing sync status of Google, Microsoft, Canvas, and Apple accounts.
  - `NotificationPreferences.tsx`: Forms for setting quiet hours, reminder offsets, and summary schedules.

### `src/lib/` (Core Business Logic and Utilities)
- **`ai/`**: AI orchestration layer.
  - `ollama.ts`: Client configuration and communication wrapper for the self-hosted Ollama model.
  - `prompts.ts`: System prompts and context-formatting templates that structure calendar data before passing it to the LLM.
  - `tools.ts`: Definitions of tool-calling functions available to the LLM (e.g., `getEvents`, `createEvent`, `findAvailableSlots`, `rescheduleEvent`).
- **`auth/`**: Authentication setup.
  - `auth.ts`: Auth.js configuration file defining OAuth providers, callback handlers, and session strategies.
- **`db/`**: Database configuration and ORM setup.
  - `db.ts`: Database client initialization connecting to PostgreSQL (Neon/Supabase).
  - `schema.ts`: Database schema definitions using an ORM (e.g., Drizzle ORM) covering users, connected accounts, unified events, tasks, goals, and user preferences.
  - `migrations/`: Folder containing SQL migration scripts.
- **`integrations/`**: External API clients and synchronization logic.
  - `google.ts`: Google Calendar API client handling token exchange, event fetching, and webhook subscriptions.
  - `microsoft.ts`: Microsoft Graph API client for Outlook/Teams calendar synchronization.
  - `canvas.ts`: Canvas LMS API client for retrieving assignments and course schedules.
  - `apple.ts`: CalDAV protocol implementation for connecting Apple iCloud calendars.
- **`notifications/`**: Communication dispatchers.
  - `email.ts`: Email notification handler utilizing Resend API for reminders and summaries.
  - `sms.ts`: SMS notification dispatcher for urgent alerts and daily morning/evening debriefs.

### `src/types/`
- **index.ts**: Shared TypeScript type definitions and interfaces for users, calendar events, tasks, API responses, and AI tool payloads across the application.

## 3. Architecture Design Patterns

- **Service-Oriented Integration Layer**: External API clients (`google.ts`, `microsoft.ts`, `canvas.ts`, `apple.ts`) act as isolated adapters that normalize distinct external payload structures into a unified internal event schema before database persistence.
- **Tool-Calling AI Architecture**: The AI assistant does not maintain raw calendar context in conversation history. Instead, the `tools.ts` module exposes deterministic functions that the Ollama LLM invokes dynamically to query targeted date ranges or modify events, ensuring adherence to context-window limitations.
- **Separation of External Events and Internal Tasks**: The database schema distinguishes between mirrored external calendar events and internal user-generated tasks/goals. This allows the AI to manage user tasks and schedule focus blocks without overwriting synchronized external calendar data.
- **Repository and Drizzle ORM Pattern**: Database interactions are centralized within lib files using typed queries, ensuring optimized indexing on user ID, start time, end time, and calendar source for sub-second query performance and efficient conflict detection."

## Database Schema Design
# Database Schema Design: Atlas

## 1. Overview
Atlas uses PostgreSQL hosted on Neon/Supabase to store user accounts, authentication tokens for external calendar integrations, synchronized calendar events, internally generated tasks/goals, user preferences, and notification rules. The relational schema is designed to cleanly separate external API data from internal app-generated state while providing rapid access for time-range queries, conflict detection, and context retrieval by the self-hosted AI assistant.

## 2. Entity-Relationship (ER) Summary
- Users (1) -> (N) Connected Accounts
- Connected Accounts (1) -> (N) Source Calendars
- Source Calendars (1) -> (N) Events (External / Unified)
- Users (1) -> (N) Tasks
- Tasks (1) -> (N) AI Work/Study Sessions (Events)
- Users (1) -> (1) User Preferences
- Users (1) -> (N) Notification Logs / Rules

## 3. Database Tables & Schema Definitions

### 3.1. users
Stores core user profile data and account status.
- id: UUID (Primary Key, default gen_random_uuid())
- email: VARCHAR(255) (Unique, Not Null)
- name: VARCHAR(255) (Not Null)
- password_hash: VARCHAR(255) (Nullable, for fallback/local auth if needed, though OAuth is primary)
- timezone: VARCHAR(64) (Not Null, default 'UTC')
- created_at: TIMESTAMPTZ (Not Null, default NOW())
- updated_at: TIMESTAMPTZ (Not Null, default NOW())

### 3.2. connected_accounts
Stores OAuth tokens and metadata for external services (Google, Microsoft, Apple/CalDAV, Canvas).
- id: UUID (Primary Key)
- user_id: UUID (Foreign Key to users.id, ON DELETE CASCADE)
- provider: VARCHAR(50) (Not Null - e.g., 'google', 'microsoft', 'canvas', 'apple')
- provider_account_id: VARCHAR(255) (Not Null)
- access_token: TEXT (Encrypted via AES-256)
- refresh_token: TEXT (Encrypted via AES-256, Nullable)
- token_expires_at: TIMESTAMPTZ (Nullable)
- scope: TEXT (Nullable)
- sync_status: VARCHAR(50) (Default 'active', e.g., 'active', 'error', 'revoked')
- last_synced_at: TIMESTAMPTZ (Nullable)
- created_at: TIMESTAMPTZ (Not Null, default NOW())
- updated_at: TIMESTAMPTZ (Not Null, default NOW())

### 3.3. source_calendars
Represents individual calendars pulled from a connected account (e.g., Work, Personal, CS101 Course Calendar).
- id: UUID (Primary Key)
- connected_account_id: UUID (Foreign Key to connected_accounts.id, ON DELETE CASCADE)
- external_calendar_id: VARCHAR(255) (Not Null)
- name: VARCHAR(255) (Not Null)
- color: VARCHAR(32) (Nullable)
- is_primary: BOOLEAN (Default FALSE)
- is_visible: BOOLEAN (Default TRUE)
- created_at: TIMESTAMPTZ (Not Null, default NOW())

### 3.4. events
Unified table for both external calendar events and internal AI-scheduled study/work blocks.
- id: UUID (Primary Key)
- user_id: UUID (Foreign Key to users.id, ON DELETE CASCADE)
- source_calendar_id: UUID (Foreign Key to source_calendars.id, ON DELETE SET NULL - Null for internal AI tasks)
- external_event_id: VARCHAR(255) (Nullable, for syncing updates from external APIs)
- title: VARCHAR(500) (Not Null)
- description: TEXT (Nullable)
- location: TEXT (Nullable)
- start_time: TIMESTAMPTZ (Not Null)
- end_time: TIMESTAMPTZ (Not Null)
- is_all_day: BOOLEAN (Default FALSE)
- event_type: VARCHAR(50) (Not Null - e.g., 'meeting', 'class', 'assignment', 'personal', 'ai_session')
- priority: INTEGER (Not Null, default 3 - Scale 1 [Lowest] to 5 [Critical Work/School/Emergency])
- status: VARCHAR(50) (Default 'confirmed', e.g., 'confirmed', 'tentative', 'cancelled')
- task_id: UUID (Foreign Key to tasks.id, ON DELETE SET NULL - Links AI sessions to specific user tasks)
- created_at: TIMESTAMPTZ (Not Null, default NOW())
- updated_at: TIMESTAMPTZ (Not Null, default NOW())

### 3.5. tasks
Internal tasks, assignments, and goals created by the user or imported via Canvas.
- id: UUID (Primary Key)
- user_id: UUID (Foreign Key to users.id, ON DELETE CASCADE)
- title: VARCHAR(500) (Not Null)
- description: TEXT (Nullable)
- deadline: TIMESTAMPTZ (Nullable)
- estimated_duration_minutes: INTEGER (Nullable, used by AI for splitting into work sessions)
- priority: INTEGER (Not Null, default 3)
- status: VARCHAR(50) (Default 'todo', e.g., 'todo', 'in_progress', 'completed')
- source: VARCHAR(50) (Default 'manual', e.g., 'manual', 'canvas')
- external_task_id: VARCHAR(255) (Nullable)
- created_at: TIMESTAMPTZ (Not Null, default NOW())
- updated_at: TIMESTAMPTZ (Not Null, default NOW())

### 3.6. user_preferences
Stores scheduling rules, working hours, and UI preferences.
- id: UUID (Primary Key)
- user_id: UUID (Foreign Key to users.id, ON DELETE CASCADE, Unique)
- working_hours_start: TIME (Default '09:00:00')
- working_hours_end: TIME (Default '17:00:00')
- work_days: INTEGER[] (Default '{1,2,3,4,5}' for Mon-Fri)
- quiet_hours_start: TIME (Nullable)
- quiet_hours_end: TIME (Nullable)
- default_meeting_duration: INTEGER (Default 30 minutes)
- notification_channels: JSONB (Stores preferences for email, SMS, in-app)
- debrief_morning_time: TIME (Default '08:00:00')
- debrief_evening_time: TIME (Default '20:00:00')
- created_at: TIMESTAMPTZ (Not Null, default NOW())
- updated_at: TIMESTAMPTZ (Not Null, default NOW())

### 3.7. notification_logs
Tracks sent and scheduled notifications to prevent duplicates and manage rate limits.
- id: UUID (Primary Key)
- user_id: UUID (Foreign Key to users.id, ON DELETE CASCADE)
- event_id: UUID (Foreign Key to events.id, ON DELETE SET NULL)
- task_id: UUID (Foreign Key to tasks.id, ON DELETE SET NULL)
- type: VARCHAR(50) (Not Null - e.g., 'reminder', 'morning_debrief', 'evening_summary', 'conflict_alert')
- channel: VARCHAR(50) (Not Null - e.g., 'email', 'sms', 'in_app')
- status: VARCHAR(50) (Not Null - e.g., 'pending', 'sent', 'failed')
- scheduled_for: TIMESTAMPTZ (Not Null)
- sent_at: TIMESTAMPTZ (Nullable)
- payload: JSONB (Stores message content or context)
- created_at: TIMESTAMPTZ (Not Null, default NOW())

## 4. Indexes & Performance Optimization
To meet MVP benchmarks (<1s query times for range lookups and conflict detection), the following indexes are implemented:

- CREATE INDEX idx_events_user_time_range ON events (user_id, start_time, end_time);
- CREATE INDEX idx_events_external_id ON events (external_event_id) WHERE external_event_id IS NOT NULL;
- CREATE INDEX idx_tasks_user_deadline ON tasks (user_id, deadline) WHERE status != 'completed';
- CREATE INDEX idx_connected_accounts_user ON connected_accounts (user_id);
- CREATE INDEX idx_notifications_scheduled ON notification_logs (status, scheduled_for) WHERE status = 'pending';

## 5. Conflict Detection & Time-Range Query Strategy
Overlapping events and schedule conflicts are computed at the database level using PostgreSQL range overlap operators or standard timestamp boundary checks:

`SELECT * FROM events WHERE user_id = $1 AND start_time < $2 AND end_time > $3 AND id != $4;`

This ensures rapid retrieval for the AI assistant when querying specific user availability windows without loading entire calendar histories into memory or context windows."

## User Flow
# 1. INTRODUCTION AND PURPOSE

Atlas is a unified calendar web application designed to aggregate schedules from Google Calendar, Microsoft Teams/Outlook, Canvas LMS, and Apple Calendar into a single interface. Alongside centralized viewing, Atlas provides a self-hosted AI assistant (powered by Ollama) capable of reading user schedules, answering natural language queries, resolving conflicts, breaking down large assignments, and scheduling optimized work or study sessions.

This User Flow Document outlines the detailed user journeys, wireframe descriptions, interaction patterns, and edge-case handlings across the core application workflows. The goal is to provide a seamless, intuitive experience that reduces scheduling friction, protects user privacy, and transforms a static calendar into an intelligent productivity partner.

---

# 2. CORE USER PERSONAS & SCENARIOS

## 2.1 Persona 1: The Overwhelmed Student (Alex)
- **Context:** Juggling classes across Canvas, personal appointments on Apple Calendar, part-time work shifts on Google Calendar, and club meetings on Microsoft Outlook.
- **Pain Points:** Missing assignment deadlines because they are buried in Canvas; double-booking work shifts with group projects; manual data entry fatigue.
- **Atlas Solution:** Centralized calendar syncs all platforms automatically. The AI assistant answers prompts like, \"Can I finish this assignment before Friday?\" and automatically schedules study sessions around existing classes.

## 2.2 Persona 2: The Busy Professional (Sarah)
- **Context:** Managing corporate meetings via Microsoft Teams and personal life via Google Calendar.
- **Pain Points:** Constant context-switching between apps; lack of uninterrupted focus time; difficulty finding work-life balance.
- **Atlas Solution:** Unified priority-based scheduling automatically flags conflicts, highlights important work commitments over personal routines, and uses background AI context to recommend optimal time blocks for deep work.

---

# 3. END-TO-END USER FLOWS

## 3.1 Flow 1: Onboarding and Account Connection

### Objective
Authenticate the user via OAuth 2.0 and securely link external calendar and LMS accounts to seed the database with initial schedule data.

### Step-by-Step User Journey
1. **Landing Page:** User navigates to the Atlas web app and clicks \"Get Started\" or \"Sign In.\"
2. **Authentication:** User authenticates via Auth.js using Google or Microsoft OAuth 2.0 (or creates an account via email/password).
3. **Dashboard / Welcome Screen:** Upon first login, an onboarding wizard prompts the user: \"Connect your calendars to let Atlas centralize your schedule.\"
4. **Account Integration Page:**
   - User sees a list of supported providers: Google Calendar, Microsoft 365 / Teams, Apple Calendar (CalDAV), and Canvas LMS.
   - User clicks \"Connect\" next to Google Calendar.
   - A standard OAuth consent popup appears. User grants read/write permissions for calendar events.
   - Upon successful authorization, the screen updates to show \"Connected\" with a green indicator and displays the list of sub-calendars available under that account (e.g., \"Primary,\" \"Work,\" \"Classes\").
5. **Sync Initiation:** The app automatically triggers an initial background synchronization via API, displaying a subtle progress indicator: \"Syncing your calendar events...\"
6. **Completion:** Once synchronization completes, the user is redirected to the main Unified Calendar view populated with their events.

### Wireframe Description: Integration Settings Modal
- **Header:** \"Connect Your Calendars & LMS\"
- **Body:** Vertical list of provider cards.
  - *Card 1 (Google):* Google Logo | \"Google Calendar\" | Status: Not Connected -> Button: [Connect Accounts]
  - *Card 2 (Microsoft):* Microsoft Logo | \"Microsoft Teams / Outlook\" | Status: Connected (3 calendars selected) -> Button: [Manage]
  - *Card 3 (Canvas):* Canvas Logo | \"Canvas LMS\" | Status: Not Connected -> Button: [Connect Accounts]
  - *Card 4 (Apple):* Apple Logo | \"Apple Calendar (CalDAV)\" | Status: Not Connected -> Button: [Connect Accounts]
- **Footer:** [Skip for Now] | [Continue to Calendar]

### Interaction Patterns & Edge Cases
- **OAuth Failure / Revocation:** If an external token expires or authorization fails, an in-app banner notifies the user: \"Google Calendar connection expired. Click here to re-authenticate.\"
- **Rate Limits & Syncing State:** When a manual \"Sync Now\" button is clicked, it enters a disabled cooldown state for 60 seconds to prevent API abuse, showing a spinner icon during active syncing.

---

## 3.2 Flow 2: Viewing and Interacting with the Unified Calendar

### Objective
Provide a clean, unified view of events across all connected sources without overwhelming the user, applying intelligent priority sorting during overlaps.

### Step-by-Step User Journey
1. **Calendar Navigation:** User views the main dashboard, which defaults to the Week view (with options for Day, Month, and Agenda views).
2. **Visual Differentiation:**
   - Events are color-coded by source (e.g., Google = Blue, Microsoft = Teal, Canvas = Red, Apple = Purple) or by category (Work/School vs. Personal).
   - Priority Indicator: High-priority work or academic commitments are displayed prominently with solid borders or distinct badges. Routine personal events appear in lighter shades.
3. **Conflict Visualization:**
   - When two events overlap (e.g., a Canvas deadline and a personal appointment), the calendar renders them side-by-side or stacked with a visual warning icon (amber exclamation badge).
4. **Event Inspection:**
   - User clicks on an event block.
   - A popover detail card appears showing title, start/end time, location, source platform, description, and assigned priority.
   - User can manually adjust priority via a dropdown menu or click \"Ask AI about this\" to jump straight to the AI assistant sidebar.

### Wireframe Description: Unified Calendar Dashboard
- **Top Navigation Bar:** [Atlas Logo] | [Day | Week | Month] | [ < Today > ] | [Sync Now] | [Notifications Bell] | [User Avatar]
- **Main Layout (Split View):**
  - **Left / Center (80% width):** Calendar grid showing time slots (vertical axis) and days of the week (horizontal axis). Overlapping events rendered cleanly with priority stacking.
  - **Right Sidebar (20% width - Collapsible):** AI Assistant Chat Panel (\"Atlas AI\").

### Interaction Patterns & Edge Cases
- **Overlapping Density:** If more than three events overlap in a single time slot, the UI collapses them into an expandable summary badge (\"+2 more events\") to prevent visual clutter.
- **Manual Priority Override:** Users can right-click any event to instantly elevate its priority to \"High,\" causing the UI to redraw and adjust conflict recommendations.

---

## 3.3 Flow 3: AI Assistant Interaction and Task Scheduling

### Objective
Allow users to converse with the self-hosted AI assistant via a persistent sidebar to query schedules, find free time slots, and create or reschedule tasks.

### Step-by-Step User Journey
1. **Initiating a Query:**
   - User focuses on the persistent AI sidebar on the right of the screen.
   - User types a natural language prompt: \"What should I work on right now?\" or \"Can I finish my CS assignment before Friday?\"
2. **Processing & Context Retrieval:**
   - The application queries the PostgreSQL database for the user's active tasks, upcoming deadlines, and events within the specified date range.
   - The structured data is passed alongside the prompt to the self-hosted LLM (Ollama / Llama/Qwen) via tool-calling architecture.
3. **AI Response & Action Proposal:**
   - The AI evaluates current workloads, identifies available study blocks, and responds in the chat interface:
     > \"You have a free 3-hour window tomorrow from 2:00 PM to 5:00 PM. I recommend using this time to work on your CS Assignment 3 before its Friday deadline.\"
   - The AI presents an interactive action card within the chat: **[Schedule Study Session: CS Assignment 3 | Tomorrow, 2:00 PM - 5:00 PM]** with buttons: [Approve & Add] and [Modify].
4. **Execution:**
   - User clicks [Approve & Add].
   - The system executes a database write, creating the internal AI session, instantly rendering the new event block onto the unified calendar in real-time.

### Wireframe Description: AI Sidebar Chat
- **Sidebar Header:** \"Atlas AI Assistant\" | [Minimize / Collapse Icon]
- **Chat History Area:**
  - *User Bubble:* \"Can I finish this assignment before Friday?\"
  - *AI Bubble:* \"Yes, you have 4 available hours across Wednesday and Thursday. Would you like me to schedule two 2-hour work blocks?\"
  - *Interactive Widget:* [Block 1: Wed 3 PM] [Block 2: Thu 2 PM] -> Buttons: [Confirm Schedule] | [Edit]
- **Chat Input Area:**
  - Text input placeholder: \"Ask about your schedule or tasks...\"
  - Send button [ > ]

### Interaction Patterns & Edge Cases
- **Ambiguous Requests:** If the user asks a vague question like \"When am I free?\", the AI responds with clarifying questions: \"For how many hours, and which days are you looking at?\"
- **Conflict Detection during AI Scheduling:** If the AI attempts to schedule a task over an existing high-priority event, deterministic backend logic intercepts the action, prevents the double-booking, and prompts the AI to propose an alternative time slot.

---

## 3.4 Flow 4: Notification Preferences and Automated Debriefs

### Objective
Give users granular control over notification channels, quiet hours, reminder timings, and automated daily/weekly summaries.

### Step-by-Step User Journey
1. **Navigating to Settings:**
   - User clicks their User Avatar -> Settings -> Notifications tab.
2. **Configuring Channels & Timing:**
   - User toggles preferred notification methods: Email (via Resend), In-App, and optional SMS.
   - User sets default event reminder timing: \"15 minutes before events\" and \"24 hours before deadlines.\"
3. **Setting Quiet Hours:**
   - User enables Quiet Hours and configures a time window (e.g., 10:00 PM to 7:00 AM) to pause non-urgent notifications.
4. **Configuring Automated Summaries:**
   - User opts into the **\"Daily Morning Debrief\"**: Configured to arrive via email or SMS at 8:00 AM every day, containing a schedule overview and top recommended tasks.
   - User opts into the **\"Evening Review\"**: Configured for 8:00 PM to summarize completed work and carry over unfinished tasks.
   - User customizes **\"Weekly Summary\"**: Selects Sunday at 6:00 PM to receive a synthesized overview of the upcoming week's workload.
5. **Saving Preferences:**
   - User clicks [Save Preferences], updating database settings immediately.

### Wireframe Description: Notification Settings Panel
- **Section 1: Channels**
  - [x] In-App Notifications
  - [x] Email Notifications (Resend)
  - [ ] SMS Notifications (Optional)
- **Section 2: Quiet Hours**
  - Enable Quiet Hours [Toggle: ON]
  - From: [ 10:00 PM ] To: [ 7:00 AM ]
- **Section 3: Automated Summaries**
  - [x] Daily Morning Debrief (Time: [ 8:00 AM ])
  - [x] Evening Review Summary (Time: [ 8:00 PM ])
  - [x] Weekly Planning Summary (Day: [ Sunday ], Time: [ 6:00 PM ])
- **Footer:** [Save Changes]

### Interaction Patterns & Edge Cases
- **SMS Availability:** If SMS is selected but not supported or configured on the free tier, an inline helper text informs the user: \"SMS notifications are currently in limited preview. Email and in-app alerts are fully active.\"
- **Quiet Hours Override:** Urgent security or critical conflict alerts bypass quiet hours, while standard event reminders are queued until the quiet hours window closes.

---

# 4. ERROR HANDLING & EXCEPTION FLOWS

- **External API Downtime:** If Google Calendar or Canvas fails to respond during a scheduled sync, the app retains the last known cached events in PostgreSQL, displays a subtle warning badge on the calendar header (\"Google sync delayed - showing cached data\"), and automatically retries in the background.
- **AI Model Timeout:** If the self-hosted Ollama model takes longer than expected to respond, the AI sidebar displays a typing indicator with a cancel option: \"Atlas is thinking... [Cancel]\", falling back to a graceful error message if the request times out.
- **Account Disconnection:** When a user revokes access to an external calendar, the system prompts: \"Do you want to keep previously synced events or delete them from your unified calendar?\" based on user preference.

---

# 5. SUMMARY OF KEY INTERACTION PATTERNS

- **Non-Intrusive AI:** The AI assistant lives exclusively in a collapsible sidebar, ensuring it never obstructs calendar viewing or manual schedule management.
- **Priority-Driven UI:** Visual conflicts are automatically flagged and prioritized, giving academic/work commitments precedence while keeping personal events visible.
- **Zero-Cost Architecture Alignment:** All user flows are optimized to minimize unnecessary API polling and external LLM token costs, relying on robust local database queries and efficient background job syncs.

## Styling Guidelines
# STYLING GUIDELINES & DESIGN SYSTEM: ATLAS

## 1. DESIGN PHILOSOPHY & UX PRINCIPLES
Atlas is designed to transform the chaotic experience of managing multiple schedules into a calm, unified, and intelligent workspace. Because our target audience—students, busy professionals, and individuals striving for work-life balance—frequently experience cognitive overload from fragmented calendars (Google, Microsoft Teams, Canvas, Apple Calendar), our interface must prioritize absolute clarity, minimalism, and focus.

### Core UX Principles:
- **Calm Productivity:** The application should feel like an intelligent assistant, not a stressful dashboard. We use generous whitespace, restrained color palettes, and clear visual hierarchy to reduce visual noise.
- **Contextual Intelligence:** The AI assistant lives natively in a persistent, collapsible sidebar. It interacts with the calendar visually and conversationally, allowing users to ask questions or resolve conflicts without jumping between views.
- **Priority-Driven Clarity:** When events overlap, the system applies an automated yet customizable priority hierarchy (work/school commitments take precedence over routine personal items, while flagged high-priority events stand out). Conflicts are highlighted cleanly with actionable AI-driven resolution paths.
- **Speed and Responsiveness:** Calendars are time-sensitive. Interactions—from toggling views to triggering manual syncs—must feel instantaneous, with clear loading skeletons to prevent layout shift.

---

## 2. COLOR PALETTE
The Atlas color system is built around a modern, accessible, dark/light-compatible aesthetic that differentiates external sources while maintaining an overarching sense of calm focus. 

### Neutral Base (Slate & Zinc Palette)
- **Background (Primary):** `#09090B` (Dark Mode) / `#FAFAFA` (Light Mode)
- **Surface / Cards (Secondary):** `#18181B` (Dark Mode) / `#FFFFFF` (Light Mode)
- **Elevated Surfaces (Dropdowns, Modals):** `#27272A` (Dark Mode) / `#F4F4F5` (Light Mode)
- **Borders & Dividers:** `#3F3F46` (Dark Mode) / `#E4E4E7` (Light Mode)
- **Text (Primary):** `#F4F4F5` (Dark Mode) / `#09090B` (Light Mode)
- **Text (Muted / Secondary):** `#A1A1AA` (Dark Mode) / `#71717A` (Light Mode)

### Brand & Accent Colors
- **Atlas Indigo (Primary Brand):** `#6366F1` (Used for primary actions, active tabs, brand moments)
- **Indigo Hover:** `#4F46E5`
- **AI Violet (Assistant Accents):** `#8B5CF6` (Used specifically for AI chat highlights, generated study sessions, and assistant triggers)

### Semantic & Priority Colors
- **Success / High Priority Personal:** `#10B981` (Emerald)
- **Warning / Overlap Conflict:** `#F59E0B` (Amber)
- **Destructive / Urgent Deadline:** `#EF4444` (Rose)

### Calendar Source Differentiation Colors
To help users instantly recognize where an event originated across Google, Microsoft, Canvas, and Apple:
- **Google Calendar Source:** `#4285F4` (Google Blue)
- **Microsoft Teams / Outlook Source:** `#0078D4` (Microsoft Blue)
- **Canvas LMS Source:** `#E05D44` (Canvas Orange-Red)
- **Apple Calendar Source:** `#A3A3A3` (Neutral Slate / Apple Gray)
- **Internal Atlas Tasks/Goals:** `#6366F1` (Atlas Indigo)

---

## 3. TYPOGRAPHY
Atlas uses clean, modern sans-serif typography optimized for high-density data rendering (such as month, week, and day grid views) while remaining highly legible across mobile and desktop viewports.

### Font Family
- **Primary Font:** Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
- **Monospace Font (for times, codes, metadata):** JetBrains Mono, ui-monospace, monospace

### Type Scale & Hierarchy
- **Display / App Title:** 24px / Bold (700) / Tracking: -0.025em
- **Heading 1 (Page / View Titles):** 20px / Semibold (600) / Tracking: -0.02em
- **Heading 2 (Section Headers, Modal Titles):** 16px / Semibold (600)
- **Heading 3 (Card Titles, Subsections):** 14px / Medium (500)
- **Body Text (Standard UI, Chat Messages):** 14px / Regular (400) / Line Height: 1.5
- **Small / Metadata (Timestamps, Source Badges):** 12px / Regular (400) / Line Height: 1.4
- **Micro (Badges, Overlap counters):** 10px / Medium (500) / Uppercase tracking

---

## 4. UI/UX COMPONENTS & PATTERNS

### Unified Calendar Grid
- **Time Blocks:** Rendered with clean border-radius (`6px`), displaying the event title, time range, and a subtle source indicator pill or left-border accent matching the source calendar color.
- **Overlap Handling:** Overlapping events automatically split columns proportionally. Conflicts are wrapped in a subtle amber border with a warning icon indicating that AI assistance is available to resolve the scheduling clash.

### AI Assistant Sidebar
- **Layout:** Positioned on the right side of the main calendar interface, fixed or collapsible without disrupting the underlying calendar grid.
- **Styling:** Distinct background tint (`#121216` in dark mode) framed by a subtle AI Violet gradient border (`#8B5CF6`). 
- **Interactive Elements:** Features quick-action chips (e.g., "What should I work on?", "Find 3 study hours", "Check deadlines this week") and inline tool-calling execution cards where users can preview and accept AI-proposed schedule changes with a single click.

### Buttons & Interactive States
- **Primary Buttons:** Solid Indigo (`#6366F1`) background with white text, rounded corners (`8px`), and smooth transition hover states.
- **Secondary Buttons:** Transparent background with subtle border and muted text, shifting to surface color on hover.
- **Focus States:** All interactive elements feature a clear 2px focus ring matching the primary brand or AI accent color to ensure complete keyboard navigation accessibility.

### Notifications & Modals
- **Toasts / Alerts:** Floating notification cards in the bottom-right corner for quick status updates (e.g., "Sync completed successfully", "Event rescheduled by AI").
- **Modals:** Centered overlays with backdrop blur (`backdrop-filter: blur(4px)`), featuring clear close buttons, distinct header hierarchies, and keyboard dismissals (ESC key support).
