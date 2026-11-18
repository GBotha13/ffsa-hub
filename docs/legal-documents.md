# Legal → Documents — plan

One place in the Hub for FFSA's legal and compliance papers and the legal
officer's own papers: what we hold, what it says, when it runs out, and what
is being applied for. Built for the legal officer (Coreen). Reminders by email
and on the Hub dashboard.

Status: **steps 1 and 2 written, not applied.** Migrations 370–372 are drafts.
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
3. **Scanning in** — upload many scans at once into a folder; text is
   extracted and fields suggested; Coreen confirms or corrects them.
   How the reading is done (Claude in the Hub, or in a session with
   Gideon) is decided when the scans exist.
4. **Reminders** — 07:00 Johannesburg cron. Email at 90, 60, 30 and 7 days
   and on the day, then weekly while overdue; one "needs you" band on the
   dashboard. A send log claims each reminder once.

Not now: Google Calendar; helpers chosen by Coreen; sharing outside the Hub.

## Open questions for Coreen

- Confirm or correct the draft document types and lead times.
- The folders she wants to start with.
- Which address reminders go to (her Hub account is the legal@ mailbox).
