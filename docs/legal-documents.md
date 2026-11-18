# Legal → Documents — plan

One place in the Hub for FFSA's legal and compliance papers and the legal
officer's own papers: what we hold, what it says, when it runs out, and what
is being applied for. Built for the legal officer (Coreen). Reminders by email
and on the Hub dashboard.

Status: **all four steps written, not applied.** Migrations 370–373 are drafts.
Do not run them until Jack says so. Until they are applied the page sends
everyone to the dashboard and the menu entry stays hidden.

Where it lives: **`/legal-documents`** (System → Documents in the sidebar).
Not under `/legal/`: that path is public in `src/middleware.ts`.

---

## Who can open it

A short, named access list (`legal_access`), and nothing else.

| Who | Why | Until |
| --- | --- | --- |
| Coreen (owner) | It is her module | — |
| Gideon (reviewer) | Building and testing | Go-live |
| Jack (reviewer) | Building and testing | Go-live |

- **No role gets in.** `is_admin()`, `super_admin` and `legal_admin` appear in
  no policy. Coreen is a super admin herself, so a role-based rule would let
  every other super admin in. Same hard wall as the Missio tables (329).
- Reviewers have the same rights as the owner while we build, so they can
  correct what they find. Coreen has agreed to this, personal papers included.
- **Before go-live:** delete the two reviewer rows (or set `ends_on`).
- Only the service role can change the access list in step 1. Coreen
  managing helpers herself (per folder, view or edit, with an end date) is a
  later step; the table already has room for it.
- Accounts must be active (`users.is_active IS NOT FALSE`), as in 313.

## What it holds

- **Folders** — standing areas (*FFSA legal*, *Coreen — personal*) or
  projects (*PBO renewal 2027*). Kind: `organisation`, `personal`, `project`.
- **Document types** — a catalogue (NPO certificate, tax compliance PIN,
  passport …) with a usual validity and a usual lead time. The seed is a
  **draft list for Coreen to confirm**; nothing in it is a legal deadline.
- **Documents** — one row per thing held or needed: holder, issuer, reference
  number, issued, expires, how many days ahead to start renewing, status
  (`held`, `applying`, `not_held`, `superseded`, `cancelled`). A renewal
  points at the document it replaces.
- **Files** — scans and PDFs in the private `legal-documents` bucket at
  `<folder id>/<file id>.<ext>` (no names in paths). A scan can arrive before
  it is matched to a document; it then sits in its folder unmatched.
  Each file keeps its **extracted text** and the **fields read from it**
  (reference number, dates, issuer), each with a review flag, so what was
  read is never taken as fact until a person confirms it.
- **Applications** — anything being applied for or renewed: lodge-by date,
  submitted, expected, closed, outcome, and a checklist of steps.
- **Event log** — every change to documents, files, applications and steps,
  with who made it. Append-only. Three people editing at once need this.

## Expiry rules (step 2, `src/lib/legal/`, tested)

- `expired` — `expires_on` is before today (Johannesburg date).
- `expiring` — within `renew_lead_days` of `expires_on`.
- `valid` — otherwise; `no_expiry` when `expires_on` is null.
- A document with a newer one superseding it is never flagged.
- An open application on a document turns "expiring" into "in hand".

## Steps

1. **Data layer** — migrations 370 (schema), 371 (RLS, grants, bucket),
   372 (draft types, the access list, starter folders); `src/services/legal-documents.ts`.
2. **Screens** — done. One page with four tabs (Needs attention,
   Documents, Applications, Folders) and the 470 px drawer for a document
   (details, scans, applications, history), an application (checklist,
   details, history) or a folder (scans to match, details, archive).
   Single scans can already be added to a document or a folder: the API
   adds the row as the user, then signs a one-time upload, and the browser
   sends the file straight to storage (no 4.5 MB serverless limit).
   Routes under `/api/legal/*`; rules in `src/lib/legal/status.ts` (tested).
3. **Scanning in** — done. *Scan in* (masthead) takes many scans into a
   folder; each is read as it lands, one at a time. Claude Opus 5.5 reads a
   copy (same set-up as the Slack receipt reader) and returns the full
   text (first 8 pages), a short summary, *things to watch* taken from
   the paper, and suggested details (type, title, holder, issuer,
   reference number, issue and expiry dates), each marked sure or not.
   All of it is stored on the file as **unconfirmed** suggestions.
   The scan review drawer pre-ticks only what the reader was sure of,
   lets the person correct any value, suggests which document it belongs
   to (same reference number → same type → same title; a later expiry
   than the one on file means a renewal, so a new document), and writes
   nothing until **Apply**. The summary and things to watch can be added
   to the document's notes, marked as read by Claude.
   Limits: PDFs over 22 MB are kept but not read; iPhone HEIC photos
   can't be read here (scan to PDF or JPG). The installed SDK (0.98)
   has no server-side refusal fallback, so a declined scan says so and
   is filled in by hand. Routes: `/api/legal/files/[id]/read` and
   `/apply`. Rules: `src/lib/legal/reading.ts` (tested).
4. **Reminders** — done. `/api/cron/legal-reminders`, 05:00 UTC (07:00
   Johannesburg), emails the **owner** only (not reviewers or helpers):
   - documents at 90, 60, 30 and 7 days before expiry and on the day,
     only the milestones inside the document's own renewal window (7 days
     always counts); once a renewal is under way only 7 and 0; after
     expiry, every 7 days;
   - applications at 14, 7 and 1 days before lodge-by and on the day,
     weekly while late, and weekly once past the expected date;
   - on Mondays, everything still open, even without a milestone;
   - nothing on a day with nothing to say; archived folders are quiet.
   Titles and dates only — no reference numbers, holders or notes.
   Sends only on production (and not with `LEGAL_REMINDER_DISABLED=1`);
   elsewhere it reports what it would send. The day is claimed in
   `legal_reminder_sends` (migration 373) before sending.
   **Preview:** Needs attention → *Preview today's email*
   (`/api/legal/reminder-preview?date=YYYY-MM-DD` to try another day).
   **Dashboard:** a *Legal papers* card for people on the access list —
   not a band, because the dashboard's one band is staff approvals.
   Rules: `src/lib/legal/reminders.ts` (tested).

Not now: Google Calendar; helpers chosen by Coreen; sharing outside the Hub.

## Open questions for Coreen

- Confirm or correct the draft document types and lead times.
- The folders she wants to start with.
- Which address reminders go to (her Hub account is the legal@ mailbox).
