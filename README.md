# Atlas

A unified, AI-powered calendar and day planner that pulls all of your calendars into one dashboard.

## Description

People juggle school, work, and personal life across several calendars and apps, which makes it hard to see what's actually coming up or to find time for the work that matters. Atlas aggregates your external calendars into a single view, then helps you plan around them: scheduling work blocks for assignments and projects, and fitting in routines like workouts.

Atlas is built for everyone, not just students. The AI only proposes changes and never edits your calendar without your approval.

**Key ideas**

- **Today** is the default view, with **Calendar** as the second main view, and an inbox alongside the calendar on the home screen.
- Events synced from external calendars are read-only. Synced events can be hidden (not deleted), with a toggle to view hidden events and their history.
- You decide priorities and conflicts. Overlapping events are allowed.
- Things you prepare for (assignments, presentations, demos) hold **tasks**; **work blocks** are scheduled time for those tasks. Completed blocks are tracked so planning improves over time.
- **Routines** can be recurring or rolling cycles (e.g. push/pull/legs/rest) and are auto-scheduled; conflicts are sent to you to resolve.
- Custom named time zones (work, sleep, leisure) and fully customizable alerts.

> Atlas is a CS 321 team project and is under active development. Not all planned features are implemented yet.

## Table of Contents

- [Description](#description)
- [Running the demo](#running-the-demo)
- [Contributing](#contributing)

## Running the demo

The `web/` folder holds a front-end demo of the Today view, built with Vite, React and CSS from the designs in `docs/design/`. It uses mock data from `web/src/data.ts` and has no backend.

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173. Refresh the page to reset the demo.

## Contributing

We're a five-person team working through GitHub issues. Each feature parent issue starts with a "Write the user story" sub-issue.

Contributors:
- Abel Tolla
- Kirollos Shafik
- David
- Athar
- Nader

A full `CONTRIBUTING.md` will be added later.
