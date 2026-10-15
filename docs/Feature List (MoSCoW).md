# Feature List (MoSCoW)

Atlas has 40 features: 23 Must, 12 Should, 5 Could, and 8 ideas ruled out for this release. The Must set is large on purpose, since the calendar, planning and tracking loop only works as a whole. The roadmap splits it across phases.

| Priority | ID | Feature | Depends on |
| --- | --- | --- | --- |
| Must | F-01 | Google and Microsoft sign-in | none |
| Must | F-40 | Security baseline | none |
| Must | F-37 | Time zones | none |
| Must | F-39 | Responsive, phone-first layout | none |
| Must | F-02 | Connect Google Calendar | F-01, F-40 |
| Must | F-03 | Connect Microsoft calendar | F-01, F-40 |
| Must | F-06 | Sync engine and Sync Now | F-02 |
| Must | F-08 | Disconnect account | F-02 |
| Must | F-38 | Data export and account deletion | F-01 |
| Must | F-09 | Day, week, month calendar | F-06 |
| Must | F-10 | Color by source | F-09 |
| Must | F-11 | Local layer, hidden events and history | F-09 |
| Must | F-12 | Conflict detection | F-09 |
| Must | F-13 | Atlas-owned events | F-09 |
| Must | F-15 | Tasks | F-13 |
| Must | F-16 | Work blocks | F-15 |
| Must | F-17 | One-tap block tracking | F-16 |
| Must | F-20 | Fixed weekly routines | F-13 |
| Must | F-14 | Today dashboard and inbox | F-09, F-28 |
| Must | F-24 | AI chat panel and bubble | F-01 |
| Must | F-25 | AI read tools | F-06 |
| Must | F-28 | Proposals and inbox approval | F-13 |
| Must | F-26 | Plan from pasted instructions | F-16, F-28 |
| Should | F-04 | Connect Canvas | F-06 |
| Should | F-05 | Connect Apple Calendar | F-06 |
| Should | F-18 | Zones | F-13 |
| Should | F-19 | Buffers and work cap | F-18 |
| Should | F-21 | Rolling-cycle routines | F-20 |
| Should | F-22 | Target routines | F-20, F-28 |
| Should | F-27 | Plan from PDF upload | F-26 |
| Should | F-29 | Learning from tracked time | F-17 |
| Should | F-30 | AI reschedule proposals | F-28 |
| Should | F-31 | Persistent chat thread | F-24 |
| Should | F-32 | Custom alerts (email, in-app) | F-13, F-15 |
| Should | F-36 | 24-hour undo | F-11 |
| Could | F-07 | Webhook real-time sync | F-06 |
| Could | F-23 | Pause routines | F-20 |
| Could | F-33 | Alert presets | F-32 |
| Could | F-34 | Push notifications (PWA) | F-32 |
| Could | F-35 | SMS alerts | F-32 |
| Won't | none | Native iOS and Android apps | later phase after web |
| Won't | none | Shared calendars and shared availability | single-user model |
| Won't | none | Two-way sync back to Google or Outlook | external events stay read-only |
| Won't | none | Resolve doc (user-written rules that settle conflicts) | Later idea |
| Won't | none | AI that resolves conflicts on its own | conflicts always go to the user |
| Won't | none | Fine-tuning the model on user data | learning is computed stats |
| Won't | none | Team features and shared workspaces | single-user model |
| Won't | none | Billing and paid plans | out of scope for the MVP |

"Won't" means not in this release. The resolve doc and sharing are the two most likely to come back.
