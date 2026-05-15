# FFSA Hub — Phase 2 Ticket Pack

A linear, paste-one-at-a-time set of tickets for the HubSpot replacement build. Pair this with `FFSA_Hub_Phase2_Spec.md` (the design doc) and `CLAUDE.md` (the project conventions). Each ticket is a self-contained prompt — paste it into Claude Code with `"Read CLAUDE.md and FFSA_Hub_Phase2_Spec.md, then: <ticket body>"`.

Tickets are ordered by dependency. Don't skip ahead; later tickets assume earlier ones shipped. Each has a definition of done — confirm green before moving to the next.

---

## Sprint 1 — Infrastructure (May 12–18)

### Ticket 1.1 — Phase 2 schema migration

**Files to create**
- `supabase/migrations/004_phase2_marketing_schema.sql`

**Description**
Write the additive Phase 2 schema migration. Include exactly the 12 tables defined in section 3.1 of `FFSA_Hub_Phase2_Spec.md`: `ALTER` to add `people.custom_fields jsonb`, then `channels`, `channel_interest_areas`, `subscriptions`, `campaigns`, `forms`, `form_submissions`, `broadcasts`, `broadcast_recipients`, `tasks`, `notes`, `activity_events`, `donations`. Include all indexes and CHECK constraints. Also include the `v_person_lifecycle` view from section 3.3.

**Acceptance criteria**
- File parses cleanly in Supabase SQL Editor (no syntax errors)
- All tables have `created_at` defaults where the spec requires
- All FKs reference existing tables (people, users, campaigns) correctly
- Generated columns (where the spec uses them) are marked `GENERATED ALWAYS AS ... STORED`
- The file is append-only; does not touch tables from 001/002/003

**Validation**
- Paste the file content into Supabase SQL Editor on a staging branch and confirm all statements succeed
- Open Supabase Table Editor and confirm all 12 new tables appear

---

### Ticket 1.2 — Phase 2 RLS policies

**Files to create**
- `supabase/migrations/005_phase2_rls_policies.sql`

**Description**
Write RLS policies for every Phase 2 table. Mirror the patterns in `002_rls_policies.sql`. Policy rules per section 3.4 of the spec. Each new table must have RLS enabled and the right policies for SELECT/INSERT/UPDATE/DELETE.

Specifically:
- `channels`, `channel_interest_areas`, `campaigns`: any authenticated user can SELECT; super_admin/admin/comms_admin can INSERT/UPDATE/DELETE
- `subscriptions`: super_admin/admin/comms_admin SELECT/UPDATE/DELETE; INSERT allowed by service-role only (form submissions go through the admin client) OR via signed unsubscribe token (handle in app layer, not RLS)
- `forms`: read all auth users; write super_admin/admin/comms_admin
- `form_submissions`: SELECT by super_admin/admin/comms_admin; INSERT only via service-role
- `broadcasts`, `broadcast_recipients`: super_admin/admin/comms_admin
- `tasks`: SELECT/UPDATE by assignee (`assigned_to_user_id = auth.uid()`) or super_admin/admin
- `notes`, `activity_events`: SELECT by super_admin/admin/comms_admin
- `donations`: SELECT by super_admin/admin/finance_admin

**Acceptance criteria**
- RLS enabled on every Phase 2 table
- At least one policy per access pattern the app needs
- Pattern matches `002_rls_policies.sql`

**Validation**
- Apply in Supabase SQL Editor
- In the Table Editor → Authentication → Policies, confirm every Phase 2 table shows policies

---

### Ticket 1.3 — Phase 2 seed data

**Files to create**
- `supabase/migrations/006_phase2_seed.sql`

**Description**
Insert the 5 channels and the 6 interest areas for The Send, per section 3.2 of the spec. Use idempotent inserts (`INSERT ... ON CONFLICT (slug) DO NOTHING`).

**Acceptance criteria**
- 5 rows in `channels` with the right slugs, sending_domains, owner_team values
- 6 rows in `channel_interest_areas` linked to the-send channel

**Validation**
- Apply in Supabase SQL Editor
- `SELECT * FROM channels` returns 5 rows
- `SELECT * FROM channel_interest_areas` returns 6 rows

---

### Ticket 1.4 — Regenerate Supabase types

**Files to create**
- Update `src/types/database.ts` (overwrite)

**Description**
Run `supabase gen types typescript --project-id <id> > src/types/database.ts` to regenerate types reflecting the Phase 2 schema. Confirm `Channel`, `Subscription`, `Form`, `FormSubmission`, `Broadcast`, `BroadcastRecipient`, `Task`, `Note`, `ActivityEvent`, `Donation`, `Campaign` are all in the generated file.

**Validation**
- `npx tsc --noEmit` passes
- New table types are importable from `@/types/database`

---

### Ticket 1.5 — Dependencies install

**Files to update**
- `package.json`

**Description**
Add the following dependencies:
- `resend` (latest)
- `@react-email/components` (latest)
- `@react-email/render` (latest)
- `stripe` (latest)
- `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-image`, `@tiptap/extension-link` (latest)
- `@hookform/resolvers`, `react-hook-form`, `zod` (if not already present)

Run `npm install` and commit the lockfile.

**Acceptance criteria**
- `npm install` succeeds
- `package.json` includes all the above

---

### Ticket 1.6 — Env var scaffolding

**Files to update**
- `.env.local.example`

**Description**
Add the Phase 2 env vars listed in `CLAUDE.md` under "Environment variables." Leave values as placeholders (e.g., `RESEND_API_KEY=re_...`). Do not commit real keys.

**Acceptance criteria**
- `.env.local.example` includes: `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `HUBSPOT_ACCESS_TOKEN`, `NEXT_PUBLIC_APP_URL`, `UNSUBSCRIBE_TOKEN_SECRET`, `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

---

### Ticket 1.7 — Resend client wrapper

**Files to create**
- `src/lib/email/resend.ts`

**Description**
Wrap the Resend SDK in a typed client factory. Export `getResendClient()` that returns a configured instance using `RESEND_API_KEY`. Export `sendTransactionalEmail({ to, from, subject, react, replyTo? })` that delegates to Resend.

**Acceptance criteria**
- Module compiles
- Throws a clear error if `RESEND_API_KEY` is missing
- Does not import any client-side-only APIs

---

### Ticket 1.8 — Stripe client wrapper

**Files to create**
- `src/lib/payments/stripe.ts`

**Description**
Wrap the Stripe SDK. Export `getStripeClient()` returning a configured Stripe instance using `STRIPE_SECRET_KEY` with the latest API version pinned. Export `createDonationCheckoutSession({ personId, amountCents, currency, isRecurring, campaignId, formSubmissionId })` that creates a Checkout Session and returns its URL.

**Acceptance criteria**
- Compiles
- Returns a URL string from `createDonationCheckoutSession`
- Sets metadata on the session: `person_id`, `campaign_id`, `form_submission_id` for webhook reconciliation

---

## Sprint 2 — Contacts Module + Migration (May 19–25)

### Ticket 2.1 — Contacts service

**Files to create**
- `src/services/contacts.ts`

**Description**
Pure data-access functions for the Contacts module. Functions to include:
- `listContacts(supabase, options: { search?, lifecycle?, tag?, channelSubscribed?, limit?, offset? })`
- `getContactById(supabase, id)`
- `createContact(supabase, data)`
- `updateContact(supabase, id, data)`
- `getContactSubscriptions(supabase, personId)`
- `getContactNotes(supabase, personId)`
- `getContactTasks(supabase, personId)`
- `getContactActivity(supabase, personId, options: { limit?, offset? })`
- `getContactLifecycle(supabase, personId)` — reads from `v_person_lifecycle`

Follow the style of `src/services/school-fees.ts` exactly.

**Acceptance criteria**
- One file, clear section dividers
- All functions accept `Client` as first param
- All return Supabase responses (`{ data, error }`)

---

### Ticket 2.2 — Contacts list page

**Files to create**
- `src/app/(admin)/contacts/page.tsx`
- `src/app/(admin)/contacts/contacts-table.tsx` (`'use client'` component)
- `src/app/(admin)/contacts/contact-filters.tsx`

**Description**
Server-rendered list of contacts with filters and search. Columns: Name, Email, Phone, Lifecycle stage, # of subscriptions, Last activity, Owner. Filters: lifecycle (Lead / Subscriber / Donor / Contact), channel subscribed, search by name or email. Pagination at 50 per page.

Add a new entry to `ADMIN_MODULES` in `src/config/modules.ts` for Contacts (it's already there — confirm it points to `/contacts`).

**Acceptance criteria**
- Page renders for an authenticated admin
- Filters work and update the URL query params
- Pagination works
- Empty state shown when no contacts match

---

### Ticket 2.3 — Contact detail page (read-only first pass)

**Files to create**
- `src/app/(admin)/contacts/[id]/page.tsx`
- `src/app/(admin)/contacts/[id]/about-card.tsx`
- `src/app/(admin)/contacts/[id]/timeline.tsx`
- `src/app/(admin)/contacts/[id]/subscriptions-card.tsx`

**Description**
Three-column layout per section 7 of the spec. Left rail = About card (name, email, phone, demographics from `people` and `people.custom_fields`). Middle = activity timeline + tasks + subscriptions. Right rail = lifecycle badge + actions (add note, assign task — these can be stubs in this ticket).

Pull lifecycle from `v_person_lifecycle`. Pull timeline from `activity_events`. Pull subscriptions from `subscriptions` joined to `channels`.

**Acceptance criteria**
- Page renders for a given contact id
- All three columns populated from real data
- Empty states when no notes / tasks / subscriptions exist
- Lifecycle badge styled per channel: gray for contact, blue for lead, green for subscriber, gold for donor

---

### Ticket 2.4 — Notes UI

**Files to create**
- `src/app/(admin)/contacts/[id]/note-form.tsx` (`'use client'`)
- `src/app/api/contacts/[id]/notes/route.ts` (POST handler)

**Description**
Inline note form on the contact detail page. Textarea + Save button. POSTs to the API which inserts into `notes` and writes an `activity_event` of type `note`.

**Acceptance criteria**
- Submitting the form creates a note row + activity_event row
- Timeline refreshes (server action revalidate or router.refresh) to show the new note
- Author is the current user

---

### Ticket 2.5 — Tasks UI

**Files to create**
- `src/app/(admin)/contacts/[id]/task-form.tsx` (`'use client'`)
- `src/app/api/contacts/[id]/tasks/route.ts` (POST handler)
- `src/app/api/tasks/[id]/complete/route.ts` (POST handler)

**Description**
Inline task form on the contact detail (title + description + due date + assignee dropdown). POSTs to create a task. Separate endpoint to mark a task complete. Tasks list on the contact detail shows open + completed.

**Acceptance criteria**
- Create task → row in `tasks` + `activity_event` of type `task`
- Complete task → sets `completed_at` + `completed_by`
- Task list shows assignee, due date, status

---

### Ticket 2.6 — HubSpot migration script

**Files to create**
- `scripts/migrate-from-hubspot.ts`
- `scripts/hubspot-list-channel-mapping.ts`

**Description**
Standalone TypeScript script (run via `tsx` or `npx ts-node`) that:
1. Connects to HubSpot via the API using `HUBSPOT_ACCESS_TOKEN`
2. Pages through `/crm/v3/objects/contacts?limit=100` until exhausted
3. For each contact: upserts into `people` (match by lower(email)), writing demographic fields to typed columns and the rest to `custom_fields`
4. Pages through `/crm/v3/lists`, applies the mapping in `hubspot-list-channel-mapping.ts`, and inserts `subscriptions` rows
5. Pages through `/crm/v3/objects/notes` and `/tasks`, inserting into `notes` and `tasks` (best-effort — log skips for unmappable ones)
6. Prints a verification report at the end: `people` inserted, `subscriptions` inserted, lists skipped, errors

The mapping file is a `Record<string, { channel_slug: string; interest_areas?: string[] }>` exported from `hubspot-list-channel-mapping.ts`. Pre-fill with the ~10 known list names from section 8.2 of the spec; the rest are filled in by the user before migration day.

Use `createAdminClient()` from `@/lib/supabase/admin` — the script bypasses RLS.

**Acceptance criteria**
- Script compiles and runs end-to-end against staging
- Dry-run mode (`--dry-run` flag) prints what it would do without writing
- Idempotent: re-running produces no duplicates (uses upserts keyed on email)
- Final report is human-readable

**Validation**
- Run `npx tsx scripts/migrate-from-hubspot.ts --dry-run` against staging
- Run again without `--dry-run` and verify counts in Supabase Table Editor

---

### Ticket 2.7 — Subscription edit panel

**Files to create**
- `src/app/(admin)/contacts/[id]/edit-subscriptions.tsx` (`'use client'`)
- `src/app/api/contacts/[id]/subscriptions/route.ts` (PUT handler)

**Description**
Admin panel on contact detail to toggle the person's subscriptions: list all 5 channels, show current state (subscribed / not / unsubscribed), allow admin to subscribe/unsubscribe on their behalf (with audit trail). For The Send, also show interest-area checkboxes.

**Acceptance criteria**
- Toggling subscribed creates/updates a `subscriptions` row
- Unsubscribing sets `opted_out_at` rather than deleting
- Re-subscribing clears `opted_out_at` and updates `opted_in_at` to now
- `activity_event` written for every change

---

## Sprint 3 — Forms + Channel Handler (May 26–Jun 1)

### Ticket 3.1 — Form schema types and validator

**Files to create**
- `src/lib/forms/schema.ts`
- `src/lib/forms/validate.ts`

**Description**
TypeScript types for the form JSON schema (field types: `text`, `email`, `phone`, `number`, `single-select`, `multi-select`, `checkbox`, `consent`, `donation-amount`). Validator function `validateSubmission(schema, data) → { valid, errors }` that checks required, types, and consent acceptance.

**Acceptance criteria**
- Types exported and importable
- Unit-testable validate function (skip writing tests for now, just make the API testable)

---

### Ticket 3.2 — Form renderer component

**Files to create**
- `src/components/forms/form-renderer.tsx` (`'use client'`)
- `src/components/forms/fields/text-field.tsx`
- `src/components/forms/fields/email-field.tsx`
- `src/components/forms/fields/phone-field.tsx`
- `src/components/forms/fields/select-field.tsx`
- `src/components/forms/fields/multi-select-field.tsx`
- `src/components/forms/fields/checkbox-field.tsx`
- `src/components/forms/fields/consent-field.tsx`
- `src/components/forms/fields/donation-amount-field.tsx`

**Description**
Client component that takes a form JSON schema and renders the corresponding fields with React Hook Form + Zod validation. Submits to a server route handler. Use shadcn components for styling.

**Acceptance criteria**
- Renders all field types
- Validates client-side, shows error messages inline
- Submits to the parent's onSubmit handler

---

### Ticket 3.3 — Public form runtime page

**Files to create**
- `src/app/(public)/f/[slug]/page.tsx`
- `src/app/(public)/f/[slug]/form-page-client.tsx`
- `src/app/(public)/f/[slug]/thank-you.tsx`
- `src/app/api/f/[slug]/submit/route.ts`

**Description**
Public form page at `/f/<form-slug>`. Server component loads the form by slug from `forms` table, passes to client renderer. Cloudflare Turnstile integrated for spam protection. Submit POSTs to `/api/f/[slug]/submit` which calls `handleFormSubmission` (next ticket) and either renders the thank-you page or returns a redirect URL (for donation forms).

**Acceptance criteria**
- Visiting `/f/<slug>` renders the form
- Submitting succeeds (with mock handler in this ticket; real one in 3.4)
- Turnstile verification gates the submit
- 404 if slug doesn't match an active form

---

### Ticket 3.4 — Channel handler service (the workflow logic)

**Files to create**
- `src/services/channel-handlers.ts`

**Description**
Implement `handleFormSubmission` exactly as defined in section 4 of `FFSA_Hub_Phase2_Spec.md`. Single function does: upsert person, upsert subscription, insert form_submission, insert activity_event, send transactional email if configured, create task if configured, return Stripe redirect URL if donation outcome.

Use `createAdminClient()` since this is called from public form submissions (no logged-in user).

**Acceptance criteria**
- Function compiles and is exported
- All seven steps execute in order
- Idempotent on re-submission (subscription upsert, not duplicate)
- Returns `{ redirectUrl?: string }`

---

### Ticket 3.5 — Seed the 5 form templates

**Files to create**
- `supabase/migrations/007_phase2_seed_forms.sql`
- `src/forms/send-night-outcome.schema.json`
- `src/forms/holy-spirit-conference.schema.json`
- `src/forms/pastors-gathering.schema.json`
- `src/forms/newsletter-signup.schema.json`
- `src/forms/donate.schema.json`

**Description**
Five form schemas as JSON files in `src/forms/`. Seed migration inserts a row in `forms` for each, pointing at the right channel, with the JSON schema embedded in the `schema` column.

**Acceptance criteria**
- Five rows in `forms`
- Each `forms.schema` is valid JSON matching the type from ticket 3.1
- Visiting `/f/send-night-outcome` renders the correct form

---

## Sprint 4 — Email (Jun 2–8)

### Ticket 4.1 — React Email layout component

**Files to create**
- `src/emails/components/layout.tsx`
- `src/emails/components/header.tsx`
- `src/emails/components/footer.tsx`

**Description**
Channel-aware shared layout. Takes a `channel: Channel` prop and renders the right header (logo + brand color) and footer (FFSA mailing address + per-channel unsubscribe URL). Footer must include both per-channel and global unsubscribe links.

**Acceptance criteria**
- Renders in `npx react-email dev`
- Footer correctly includes a tokenized unsubscribe URL constructed from `NEXT_PUBLIC_APP_URL` + signed token

---

### Ticket 4.2 — Transactional email templates

**Files to create**
- `src/emails/welcome-ministry-night.tsx`
- `src/emails/welcome-the-send.tsx`
- `src/emails/welcome-holy-spirit-conf.tsx`
- `src/emails/welcome-pastors-gathering.tsx`
- `src/emails/welcome-donor.tsx`
- `src/emails/donation-thank-you.tsx`
- `src/emails/unsubscribe-confirmation.tsx`
- `src/emails/task-assigned-to-staff.tsx`

**Description**
Eight React Email templates per section 6.3 of the spec. Each imports the shared layout and renders a tasteful welcome / confirmation. Pass props: `{ person, channel, ...templateSpecificProps }`.

**Acceptance criteria**
- Each template renders in `npx react-email dev`
- HTML preview looks correct in desktop + mobile widths
- All templates use the shared layout

---

### Ticket 4.3 — Unsubscribe flow

**Files to create**
- `src/lib/tokens/unsubscribe.ts` (HMAC sign/verify)
- `src/app/(public)/unsubscribe/page.tsx`
- `src/app/(public)/unsubscribe/unsubscribe-form.tsx` (`'use client'`)
- `src/app/api/unsubscribe/route.ts` (POST handler)

**Description**
Public unsubscribe page accessed via signed token in email footers. Page shows: "You're unsubscribing from <channel name>. You'll still receive: <other channels>." with two buttons: confirm channel unsub / unsubscribe from everything.

Token signing uses `UNSUBSCRIBE_TOKEN_SECRET`. Token payload: `{ person_id, channel_id, exp }` with 30-day expiry.

**Acceptance criteria**
- Visiting `/unsubscribe?t=<token>` renders the page
- Invalid / expired token shows a friendly error
- Confirm channel unsub → sets `opted_out_at` on that subscription only
- Unsubscribe from everything → sets `opted_out_at` on all of the person's subscriptions
- `activity_event` written

---

### Ticket 4.4 — Tiptap broadcast composer

**Files to create**
- `src/app/(admin)/communications/broadcasts/page.tsx` (list view)
- `src/app/(admin)/communications/broadcasts/new/page.tsx`
- `src/app/(admin)/communications/broadcasts/new/composer.tsx` (`'use client'`)
- `src/app/(admin)/communications/broadcasts/new/composer-blocks.tsx`
- `src/app/(admin)/communications/broadcasts/new/audience-panel.tsx`
- `src/services/broadcasts.ts`
- `src/app/api/broadcasts/route.ts`
- `src/app/api/broadcasts/[id]/route.ts` (GET, PUT, DELETE)

**Description**
The composer per section 6.4 of the spec. Channel dropdown locks audience and sending domain. Subject + preview text + from-name fields. Tiptap editor with block types: heading, paragraph, image, button, divider, quote, two-column. Save Draft / Send Test / Schedule / Send Now actions.

Body is stored as Tiptap JSON in `broadcasts.body`. Rendering to HTML for the actual email send happens in ticket 4.5.

**Acceptance criteria**
- Composer page renders for `comms_admin`
- Picking a channel updates the audience-size display
- Save Draft persists the draft and returns to the broadcasts list
- Image upload writes to Supabase Storage bucket `broadcast-images`

---

### Ticket 4.5 — Broadcast send worker

**Files to create**
- `src/services/broadcast-send.ts`
- `src/app/api/broadcasts/[id]/send/route.ts` (POST handler)
- `src/emails/broadcast-shell.tsx` (React Email template that renders Tiptap JSON content)

**Description**
The send pipeline. Endpoint receives `broadcastId`, validates status is `draft` or `scheduled`, queries `subscriptions` for the channel (filtered by interest area if set), batches 1000 recipients at a time, sends through Resend's bulk API, writes `broadcast_recipients` rows, updates broadcast status to `sent`.

The `broadcast-shell.tsx` template wraps the Tiptap JSON content in the channel layout from ticket 4.1.

**Acceptance criteria**
- POST to `/api/broadcasts/[id]/send` actually sends emails via Resend
- Test mode sends only to a passed-in test recipient list
- `broadcast_recipients` row created per delivery
- Broadcast status moves draft → sending → sent
- Errors during send don't block the rest of the batch; row gets `bounce_reason`

---

### Ticket 4.6 — Resend webhook handler

**Files to create**
- `src/app/api/integrations/resend/webhook/route.ts`

**Description**
POST endpoint Resend calls for delivery / open / click / bounce / complaint events. Verifies signature with `RESEND_WEBHOOK_SECRET`. Looks up the `resend_message_id` on `broadcast_recipients`, updates the right timestamp column (`delivered_at`, `opened_at`, `first_clicked_at`, `bounced_at`). Also writes an `activity_event` of type `email_opened` or `email_clicked` per event (skip for delivery to avoid timeline noise).

**Acceptance criteria**
- Endpoint verifies signature and rejects unsigned requests
- Each event type updates the right column
- `activity_event` rows created for opens and clicks
- Handles unknown message_ids gracefully (logs, returns 200)

---

### Ticket 4.7 — Subscription preferences page

**Files to create**
- `src/app/(public)/preferences/page.tsx`
- `src/app/(public)/preferences/preferences-form.tsx` (`'use client'`)
- `src/app/api/preferences/route.ts` (POST handler)

**Description**
Token-gated public page where a subscriber can view and edit their own subscriptions (toggle channels, manage The Send interest areas). Token is the same HMAC pattern as unsubscribe but scoped to person rather than channel.

Linked from every email footer next to the unsubscribe link.

**Acceptance criteria**
- Visiting `/preferences?t=<token>` renders the subscriber's current state
- Form submits update `subscriptions` rows accordingly
- `activity_event` written for changes

---

## Sprint 5 — Donations + Reports + Cutover Prep (Jun 9–15)

### Ticket 5.1 — Stripe Checkout for donations

**Files to update**
- `src/lib/payments/stripe.ts` (extend the helper from 1.8)
- `src/services/channel-handlers.ts` (wire `createStripeCheckoutSession` into the donation branch)

**Description**
Complete the Stripe Checkout flow: when a form submission has `outcome === 'donation'`, redirect the user to a Stripe-hosted Checkout page. Pass amount (cents, ZAR), recurring flag, and metadata. Success URL: `/donate/thanks?session_id={CHECKOUT_SESSION_ID}`. Cancel URL: `/donate/cancelled`.

**Acceptance criteria**
- Submitting the Donate form redirects to Stripe Checkout in test mode
- Test card 4242424242424242 completes successfully
- Returning to the success URL renders a thank-you page

---

### Ticket 5.2 — Stripe webhook handler

**Files to create**
- `src/app/api/integrations/stripe/webhook/route.ts`

**Description**
POST endpoint Stripe calls. Verifies signature with `STRIPE_WEBHOOK_SECRET`. Handles `checkout.session.completed` and `customer.subscription.created` events. On completion: marks `donations.status = 'succeeded'`, sets `paid_at`, fires the Donation Thank You email, subscribes the person to the Donors channel (if not already), and (next ticket) creates a Xero invoice.

**Acceptance criteria**
- Endpoint verifies signature
- `donations` row updated correctly
- Subscriber to Donors channel created
- Thank-you email sent

---

### Ticket 5.3 — Xero invoice on successful donation

**Files to update**
- `src/services/xero.ts`
- `src/app/api/integrations/stripe/webhook/route.ts` (call into Xero after marking donation succeeded)

**Description**
After a donation succeeds, create a corresponding invoice in Xero via the existing Xero client. Match the existing pattern in the codebase. Store the resulting `xero_invoice_id` on the donation row.

**Acceptance criteria**
- Successful test donation creates a real Xero invoice in the sandbox
- `donations.xero_invoice_id` populated
- Errors don't block the rest of the webhook handling (log, continue)

---

### Ticket 5.4 — Forms admin page

**Files to create**
- `src/app/(admin)/communications/forms/page.tsx`
- `src/app/(admin)/communications/forms/[id]/page.tsx`

**Description**
Admin views for inspecting forms and their submissions. List page shows all forms with submission counts. Detail page shows recent submissions, conversion rates, top campaigns.

**Acceptance criteria**
- Lists forms with channel + campaign + submission count + status
- Detail page shows last 50 submissions with timestamp + email + outcome
- Can deactivate a form (`is_active = false`)

---

### Ticket 5.5 — Channels admin page

**Files to create**
- `src/app/(admin)/communications/channels/page.tsx`
- `src/app/(admin)/communications/channels/[id]/page.tsx`

**Description**
List and detail pages for channels. Detail shows subscriber count, recent broadcasts, growth chart (subscribers over time, last 90 days).

**Acceptance criteria**
- Channels list with subscriber counts
- Detail page with subscriber count, last 10 broadcasts, growth sparkline

---

### Ticket 5.6 — Engagement dashboard

**Files to create**
- `src/app/(admin)/communications/page.tsx`
- `src/app/(admin)/communications/dashboard-widgets.tsx`

**Description**
The Communications module landing page. Three sections: campaigns overview (leads captured per active campaign, last 30 days), broadcasts overview (open / click rates of last 10 sends), donations overview (donation revenue last 30 days, top campaigns).

Use Recharts (already in the codebase via shadcn). Read from the existing tables; no new schema.

**Acceptance criteria**
- Page renders with three sections
- Charts populate from real data (or sensible empty state)
- Visible to `comms_admin` and above

---

### Ticket 5.7 — Webflow embed swap documentation

**Files to create**
- `docs/webflow-cutover.md`

**Description**
Step-by-step doc for swapping Webflow form embeds from HubSpot to FFSA Hub. List every HubSpot form embed currently on the Webflow site, the corresponding FFSA Hub form URL, and the exact embed code to replace it with. Include rollback instructions.

**Acceptance criteria**
- Every active HubSpot form on Webflow accounted for
- Each row: HubSpot form name → FFSA Hub `/f/<slug>` URL → embed snippet
- Test plan: how to verify each form works after the swap

---

### Ticket 5.8 — Migration day runbook

**Files to create**
- `docs/migration-runbook.md`

**Description**
Detailed runbook for the cutover day. T-7 / T-1 / T-day pre-noon / T-day afternoon / T-day evening / T+1 / T+7. Each step has an owner, expected duration, and rollback plan.

**Acceptance criteria**
- Runbook covers every step from section 8.4 of the spec
- Each step has a checkbox
- Rollback plan documented per step

---

## Post-cutover

### Ticket 6.1 — Decommission HubSpot integration

**Files to update / remove**
- Remove `HUBSPOT_ACCESS_TOKEN` from `.env.local.example`
- Archive `scripts/migrate-from-hubspot.ts` to `scripts/archive/`

**Description**
After 7 days of green operations, cancel the HubSpot subscription, remove the migration env var, and archive the migration script.

---

### Ticket 6.2 — Phase 3 backlog seeded

**Files to create**
- `docs/phase3-backlog.md`

**Description**
Capture the Phase 3 items deferred per section 11 of the spec: Alumni channel, Postmark BCC for 1:1 email logging, A/B testing UI, in-app form builder UI, dynamic list query builder, per-subscriber frequency preference, saved broadcast templates, Slack notifications.

---

## How to use this pack

1. Read `CLAUDE.md` and `FFSA_Hub_Phase2_Spec.md` once at the start of any session.
2. Pick the lowest-numbered ticket that isn't done.
3. Paste the ticket body into Claude Code as a prompt.
4. Verify the acceptance criteria + validation step.
5. Commit. Move to the next ticket.

If a ticket reveals a gap in the spec, update the spec **before** continuing. The spec is the source of truth; the tickets are scaffolding.
