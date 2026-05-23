# FFSA Hub — CRM Module Spec

**Status:** v1 draft, 2026-05-18
**Owners:** Jack Kilman
**Supersedes:** the (missing) `FFSA_Hub_Phase2_Spec.md` referenced by `phase2-tickets.md`. Treat this file as the source of truth for CRM work; treat `phase2-tickets.md` as historical context only — ticket bodies are illustrative, not binding.

---

## 1. Purpose

The CRM is the part of FFSA Hub that owns **contacts and the ministry's communication with them**. It replaces ad-hoc spreadsheets and the previous HubSpot setup. It is composed of two tightly connected modules:

- **Contacts module** — who people are, what they're interested in, how they've engaged.
- **Communication module** — how and when we reach those people, the analytics on those sends, and the public-facing forms that capture new contacts.

The CRM holds ~8,000 contacts on day one (migrated from CSV) and grows from there. International audience; POPIA + GDPR compliance required.

---

## 2. Architectural overview

```
                ┌─────────────────────┐
                │  Public forms       │  (hosted by FFSA Hub at /f/<slug>)
                │  + CSV imports      │
                └──────────┬──────────┘
                           ▼
              ┌────────────────────────┐
              │   Contacts module      │  contacts, labels, contact_labels,
              │   (data + people UI)   │  activity_events, dedup_review_queue
              └────────────┬───────────┘
                           ▼  (label assignment drives audience)
              ┌────────────────────────┐
              │  Communication module  │  forms, campaigns, campaign_recipients,
              │  (sending + analytics) │  unsubscribes, suppressions
              └────────────┬───────────┘
                           ▼
              ┌────────────────────────┐
              │  Email providers       │  Resend (transactional),
              │                        │  Mailtrap (marketing/broadcast)
              └────────────────────────┘
```

Every outbound message logs back into `activity_events` so the Contacts module shows full history without manual entry.

---

## 3. Data model

All tables live in the `public` schema. RLS enabled on every new table. New tables are additive; we do not drop or restructure tables from migrations 001–040 except as noted.

### 3.1 Extend `contacts`

The existing `contacts` table (from migration 005, renamed from `people`) has: `id, first_name, last_name, preferred_name, email, phone, address_line_1, address_line_2, city, province, country, postal_code, notes, status, created_at, updated_at`.

Add these columns:

| Column | Type | Notes |
|---|---|---|
| `date_of_birth` | `date` | Optional |
| `marital_status` | `text` | Optional, free-text (matches CSV intake) |
| `gender` | `text` | Optional |
| `nationality` | `text` | Optional, ISO country name or free text |
| `preferred_language` | `text` | Optional, defaults to `'en'` if set elsewhere |
| `preferred_channel` | `text` | Enum-ish: `'email' | 'whatsapp' | 'sms'`. Default `'email'` |
| `source` | `text` | Free-text origin string (e.g. `'csv:send-2026-cape-town'`, `'form:newsletter-signup'`) |
| `owner_id` | `uuid` | Optional FK → `users.id`. Internal staff member responsible |
| `marketing_status` | `text` | Enum: `'subscribed' | 'unsubscribed_all' | 'bounced' | 'pending'`. Default `'subscribed'` |
| `last_interaction_at` | `timestamptz` | Auto-updated by trigger on `activity_events` insert |
| `phone_normalized` | `text` | E.164 form of `phone`, computed via trigger. **Used for dedup.** Indexed. |
| `email_normalized` | `text` | `lower(email)`. Generated column. Indexed. |

Indexes: `idx_contacts_email_normalized`, `idx_contacts_phone_normalized`, `idx_contacts_owner`, `idx_contacts_marketing_status`, `idx_contacts_last_interaction`.

The existing `tags` + `person_tags` tables are **not used by the CRM**. We may drop them in a later cleanup migration; they are inert today.

### 3.2 `labels` and `contact_labels`

Labels are the unifying primitive. A label simultaneously represents (a) an interest area and (b) an email-list subscription.

```sql
CREATE TABLE public.labels (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,            -- e.g. 'send-2026', 'act-now-unreached'
  name          text NOT NULL,                   -- display name
  description   text,
  category      text,                            -- optional grouping ('The Send', 'Schools', 'Donors', etc.)
  color         text,                            -- hex, for UI badges
  is_preset     boolean NOT NULL DEFAULT false,  -- preset vs custom
  is_active     boolean NOT NULL DEFAULT true,
  sending_identity_id uuid REFERENCES public.sending_identities(id), -- which From: address campaigns to this label use
  created_by    uuid REFERENCES public.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.contact_labels (
  contact_id   uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  label_id     uuid NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  added_at     timestamptz NOT NULL DEFAULT now(),
  added_via    text NOT NULL,                    -- 'form:<form_id>' | 'csv:<import_id>' | 'manual:<user_id>' | 'import:<source>'
  added_by     uuid REFERENCES public.users(id), -- staff if manual
  PRIMARY KEY (contact_id, label_id)
);

CREATE INDEX idx_contact_labels_label ON public.contact_labels(label_id);
CREATE INDEX idx_contact_labels_contact ON public.contact_labels(contact_id);
```

**Rules:**
- A contact has zero or more labels.
- One label per send (no AND/OR audience composition in v1).
- Removing a label from a contact = unsubscribing them from that label's stream.
- Unsubscribing from a label's stream (via email footer) = removing the label.
- Removing a label does **not** delete activity history — the timeline still shows the event that originally added it.
- Preset labels (`is_preset = true`) are managed centrally; custom labels can be created on the fly (form builder, CSV import, contact detail UI).

### 3.3 `sending_identities`

```sql
CREATE TABLE public.sending_identities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,            -- 'the-send', 'schools', 'ministry-night', etc.
  display_name  text NOT NULL,                   -- 'FFSA — The Send'
  from_email    text NOT NULL,                   -- 'send@ffsahub.com'
  from_name     text NOT NULL,                   -- 'The Send Team'
  reply_to      text,
  provider      text NOT NULL CHECK (provider IN ('mailtrap', 'resend')),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

Each label points at a sending identity. Resend handles transactional (per-user system mail); Mailtrap handles marketing/broadcasts. v1 ships at least one Mailtrap identity per ministry stream the user defines.

### 3.4 `activity_events`

The unified timeline for a contact.

```sql
CREATE TABLE public.activity_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id    uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  event_type    text NOT NULL,                   -- see enum below
  payload       jsonb,                           -- event-specific data
  related_label_id     uuid REFERENCES public.labels(id),
  related_form_id      uuid REFERENCES public.forms(id),
  related_campaign_id  uuid REFERENCES public.campaigns(id),
  related_user_id      uuid REFERENCES public.users(id), -- staff member, when applicable
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_events_contact ON public.activity_events(contact_id, occurred_at DESC);
CREATE INDEX idx_activity_events_type ON public.activity_events(event_type);
```

Allowed `event_type` values:
- `contact_created`, `contact_updated`, `contact_merged`
- `label_added`, `label_removed`
- `form_submitted`
- `csv_imported`
- `event_attended` (manual or from existing event-attendance tables)
- `email_sent`, `email_delivered`, `email_opened`, `email_clicked`, `email_bounced`, `email_complained`, `email_unsubscribed`
- `note_added` (staff free-text)
- `manual_interaction` (call, meeting, etc.)

A trigger on `activity_events INSERT` updates `contacts.last_interaction_at`.

### 3.5 `forms` + `form_submissions`

```sql
CREATE TABLE public.forms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,
  name          text NOT NULL,
  description   text,
  schema        jsonb NOT NULL,                  -- field definitions (see §6)
  label_id      uuid NOT NULL REFERENCES public.labels(id), -- label applied on submission
  custom_label_allowed boolean NOT NULL DEFAULT false, -- can submitter create a new label on submit?
  sending_identity_id  uuid REFERENCES public.sending_identities(id),
  welcome_campaign_id  uuid REFERENCES public.campaigns(id), -- optional automated welcome (v2)
  redirect_url  text,                            -- thank-you redirect; null = built-in page
  is_active     boolean NOT NULL DEFAULT true,
  created_by    uuid REFERENCES public.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.form_submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id       uuid NOT NULL REFERENCES public.forms(id) ON DELETE RESTRICT,
  contact_id    uuid REFERENCES public.contacts(id),
  raw_data      jsonb NOT NULL,                  -- exactly what was submitted
  ip_address    text,
  user_agent    text,
  consent_record_id uuid REFERENCES public.consent_records(id),
  dedup_action  text NOT NULL CHECK (dedup_action IN ('new', 'matched', 'queued_for_review')),
  submitted_at  timestamptz NOT NULL DEFAULT now()
);
```

### 3.6 `campaigns` + `campaign_labels` + `campaign_recipients`

```sql
CREATE TABLE public.campaigns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,                   -- internal name
  subject       text NOT NULL,
  preview_text  text,
  body_html     text NOT NULL,                   -- rendered email html
  body_source   jsonb,                           -- composer source (Tiptap JSON or markdown)
  sending_identity_id uuid NOT NULL REFERENCES public.sending_identities(id),
  status        text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  scheduled_at  timestamptz,
  sent_at       timestamptz,
  created_by    uuid REFERENCES public.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Many-to-many: a campaign targets one or more labels with OR semantics
-- (a contact in ANY of the picked labels receives the send).
CREATE TABLE public.campaign_labels (
  campaign_id  uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  label_id     uuid NOT NULL REFERENCES public.labels(id) ON DELETE RESTRICT,
  added_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, label_id)
);

CREATE TABLE public.campaign_recipients (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id    uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  provider_message_id text,                      -- Mailtrap message id for webhook reconciliation
  sent_at       timestamptz,
  delivered_at  timestamptz,
  opened_at     timestamptz,                     -- first open
  first_clicked_at timestamptz,
  bounced_at    timestamptz,
  bounce_reason text,
  complained_at timestamptz,
  unsubscribed_at timestamptz,
  UNIQUE (campaign_id, contact_id)
);

CREATE INDEX idx_campaign_recipients_message ON public.campaign_recipients(provider_message_id);
```

### 3.7 `unsubscribes` + `suppressions`

```sql
CREATE TABLE public.unsubscribes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id    uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  label_id      uuid REFERENCES public.labels(id), -- null = global (all labels)
  reason        text,
  source        text NOT NULL CHECK (source IN ('email_footer', 'preferences_page', 'staff_manual', 'bounce_threshold', 'complaint')),
  unsubscribed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contact_id, label_id)
);

CREATE TABLE public.email_suppressions (
  email_normalized text PRIMARY KEY,
  reason        text NOT NULL CHECK (reason IN ('hard_bounce', 'complaint', 'manual')),
  added_at      timestamptz NOT NULL DEFAULT now()
);
```

A row in `unsubscribes` is the canonical record of opt-out for that label. The application layer enforces: **inserting an `unsubscribes(contact_id, label_id)` row deletes the matching `contact_labels` row**, and **deleting a `contact_labels` row inserts a corresponding `unsubscribes` row** (with `source = 'staff_manual'`). One trigger pair on each table keeps this in sync.

`email_suppressions` is global — checked before every send regardless of label.

### 3.8 `dedup_review_queue`

```sql
CREATE TABLE public.dedup_review_queue (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incoming_data jsonb NOT NULL,                  -- the submission that triggered the conflict
  email_match_contact_id uuid REFERENCES public.contacts(id),
  phone_match_contact_id uuid REFERENCES public.contacts(id),
  source_type   text NOT NULL CHECK (source_type IN ('form', 'csv', 'manual')),
  source_id     text,                            -- form_id, csv_import_id, etc.
  status        text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'resolved_merge', 'resolved_separate', 'resolved_discard')),
  resolved_by   uuid REFERENCES public.users(id),
  resolved_at   timestamptz,
  resolution_notes text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

### 3.9 `csv_imports`

```sql
CREATE TABLE public.csv_imports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename      text NOT NULL,
  row_count     integer NOT NULL,
  label_id      uuid REFERENCES public.labels(id), -- label applied to every row (optional, can be per-row in CSV)
  custom_label_name text,                        -- if a fresh label was created at import time
  status        text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  imported_count integer DEFAULT 0,
  matched_count integer DEFAULT 0,
  review_count  integer DEFAULT 0,
  error_count   integer DEFAULT 0,
  error_log     jsonb,
  created_by    uuid REFERENCES public.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);
```

---

## 4. Deduplication

When a new contact submission arrives (form, CSV, or manual), the system runs this algorithm:

1. Normalize email to `lower(trim(email))` and phone to E.164 (`+CCC...`, using `libphonenumber-js` with a default region from form/import metadata; default `ZA` if absent).
2. Query `contacts` for rows where `email_normalized = ?` OR `phone_normalized = ?`.
3. Three outcomes:
   - **0 matches** → insert a new contact. Write `activity_events.contact_created`.
   - **1 match** → update the existing contact: append the new label (if not already present), fill in any blank fields with the new data (never overwrite existing values), write `activity_events.contact_updated` + `label_added` as appropriate.
   - **2 matches (email matches A, phone matches B)** → insert a row into `dedup_review_queue`, do not modify either contact yet. Staff resolves manually via UI: merge into one, keep separate, or discard.

Phone matching only fires when `phone_normalized` is non-null and ≥ 8 digits. Email matching is case-insensitive (via `email_normalized` generated column).

Idempotency: if a CSV row would produce no changes to the matched contact, we still write an `activity_event` of type `csv_imported` for the audit trail.

---

## 5. Labels & subscription semantics

- A contact with label `X` is subscribed to the email stream associated with label `X`.
- Sending a campaign targeted at label `X` enumerates all current `contact_labels(label_id = X)`, filters out those in `unsubscribes(label_id = X)` or `email_suppressions`, and writes one `campaign_recipients` row per remaining contact.
- Adding a label = subscribing. Removing a label = unsubscribing (writes an `unsubscribes` row).
- A "global unsubscribe" sets `contacts.marketing_status = 'unsubscribed_all'` and writes an `unsubscribes(contact_id, label_id = NULL)` row. The send query excludes all contacts in this state regardless of labels.

Audience composition for v1 = **one or more labels per campaign with OR semantics** — a contact on ANY of the picked labels receives the send. v2 adds AND + field filters.

---

## 6. Forms

A form is a JSON schema + a target label. The schema follows this shape (TypeScript):

```ts
type FormSchema = {
  title: string;
  description?: string;
  consent: {
    agreement_version: string;   // FK to consent_agreements.version
    required: true;
  };
  fields: FormField[];
};

type FormField =
  | { type: 'text'; key: string; label: string; required?: boolean }
  | { type: 'email'; key: 'email'; label: string; required: true }     // always required, always keyed 'email'
  | { type: 'phone'; key: 'phone'; label: string; required?: boolean; default_region?: string }
  | { type: 'date'; key: string; label: string }
  | { type: 'select'; key: string; label: string; options: string[]; required?: boolean }
  | { type: 'multiselect'; key: string; label: string; options: string[] }
  | { type: 'checkbox'; key: string; label: string }
  | { type: 'textarea'; key: string; label: string; required?: boolean };
```

Public form runtime lives at `/f/<slug>` (route group `(public)`). Spam protection via Cloudflare Turnstile (already in CLAUDE.md's env vars). Submission flow:

1. Verify Turnstile token.
2. Validate against the form's schema.
3. Insert `consent_records` row (source: `'form'`, applicant_email).
4. Run dedup (§4) using the submitted email/phone.
5. Upsert contact, assign the form's `label_id`, write `activity_events.form_submitted` and `label_added`.
6. Insert `form_submissions` row with `consent_record_id` and `dedup_action`.
7. If the form has a `welcome_campaign_id`, queue the welcome send (v2 feature, no-op in v1).
8. Render `redirect_url` if set, else built-in thank-you page.

Form builder UI lives at `/admin/communications/forms/`. Admins pick fields from a palette, choose a label (preset or new), optionally allow submitter to add a custom label, set the redirect URL, save. URL `/f/<slug>` then activates.

---

## 7. Campaigns

Composer lives at `/admin/communications/campaigns/new`. Fields: name, subject, preview text, label (audience), sending identity, scheduled_at, body. Body is a Tiptap-rendered HTML email (matches phase2-tickets approach; reuses the Tiptap install already in package.json).

Send pipeline:

1. Staff hits "Send Now" or scheduler fires at `scheduled_at`.
2. Worker queries audience via `v_campaign_audience` keyed on `campaign_id` — returns DISTINCT contacts holding ANY of the campaign's labels (from `campaign_labels`), minus globally-unsubscribed contacts (`unsubscribes.label_id IS NULL` or `marketing_status != 'subscribed'`) and suppressed emails. Per-label unsubscribes don't need a filter here — they already removed the contact_labels row via the migration 046 trigger.
3. Batch into groups of 500, send via Mailtrap bulk API.
4. For each delivery: insert `campaign_recipients` with `provider_message_id`, write `activity_events.email_sent`.
5. Mailtrap webhook hits `/api/integrations/mailtrap/webhook` → updates the right timestamp column on `campaign_recipients` AND writes the corresponding `activity_events` row (`email_delivered`, `email_opened`, `email_clicked`, `email_bounced`, `email_complained`).
6. Hard bounces add to `email_suppressions`; complaints add to both `email_suppressions` and a global unsubscribe.

A/B testing (v2): manual winner pick. v1 ships single-variant only.

---

## 8. Compliance

### Consent
- Every form submission writes a `consent_records` row (existing table from migration 034, already POPIA-compliant).
- Double opt-in: in v1, default to single opt-in (matches HubSpot's previous behavior) with the option flag per form. **Double opt-in implementation is in v1 scope.** If `forms.double_opt_in = true` (we'll add this column), the new contact has `marketing_status = 'pending'` and we send a confirmation email via Resend; clicking the link sets `marketing_status = 'subscribed'`.

### Unsubscribe
- Every campaign email footer includes a signed "Manage preferences" link (HMAC token, payload `{contact_id, campaign_id, exp}`, 30-day expiry). `/unsubscribe` and `/preferences` both route to the same checkbox preferences page.
- The preferences page lists **all** the contact's current labels as checkboxes (pre-checked = subscribed). Labels used by the campaign that sent this link are visually grouped/highlighted at the top so the recipient knows which list they're acting on. Submit removes any unchecked labels (writes an `unsubscribes` row with `source = 'preferences_page'`; trigger removes the matching `contact_labels` row).
- A separate "Unsubscribe from all marketing" button writes a global unsubscribe (`unsubscribes.label_id IS NULL`), which the migration 046 trigger expands into removal of every contact_labels row + `marketing_status = 'unsubscribed_all'`.
- All POPIA requirements: per-stream unsubscribe + global unsubscribe + suppression list.

### Data export
- `/admin/contacts/<id>/export` returns a JSON dump of all data for a contact (contact row + labels + activity + form submissions + consent records).

### Right-to-be-forgotten
- `/admin/contacts/<id>/delete` (super_admin only) anonymizes the contact:
  - PII fields → null
  - `email_normalized`, `phone_normalized` → null
  - `status` → `'archived'`
  - Activity events kept (FK kept) for analytics
  - Consent records kept (legally required)

---

## 9. Permissions

Uses the existing `permissions` + `user_permissions` system (migration 014/015/040). New permission keys to add:

| Key | Description |
|---|---|
| `contacts.read` | View contact list and details |
| `contacts.write` | Create / edit contacts |
| `contacts.export` | Export contact data |
| `contacts.delete` | RTBF / hard archive |
| `contacts.dedup_review` | Resolve dedup conflicts |
| `labels.read` | View labels |
| `labels.manage` | Create / edit / delete labels |
| `forms.read` | View forms |
| `forms.manage` | Create / edit / publish forms |
| `campaigns.read` | View campaigns and analytics |
| `campaigns.draft` | Create / edit drafts |
| `campaigns.send` | Hit send |
| `imports.run` | Run CSV imports |

Permission scoping (per existing system) allows e.g. "schools admin can see only contacts labeled `Schools`" — implemented as a filter on label_id at the service layer, gated on the user's scope.

---

## 10. Integrations

| Integration | Purpose | Env vars |
|---|---|---|
| **Resend** | Transactional email (already wired, 9 templates) — invites, references, application confirmations, double opt-in confirmation, unsubscribe confirmation, RTBF confirmation | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| **Mailtrap** | Marketing / broadcast email — campaigns to label audiences | `MAILTRAP_API_TOKEN`, `MAILTRAP_ACCOUNT_ID` (new) |
| **Cloudflare Turnstile** | Public form spam protection | `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` |
| **Twilio** (v3) | WhatsApp channel | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` |

Multi-channel abstraction (v3): a `messages` table replaces the email-specific parts of `campaign_recipients`, with `channel = 'email' | 'whatsapp' | 'sms'`. Out of scope for v1.

---

## 11. CSV import

- UI at `/admin/contacts/import`.
- Staff uploads CSV. Required column: `email` OR `phone` (at least one per row).
- Staff maps CSV columns to contact fields (defaults inferred from header names matching field names).
- Staff picks a label to apply to all rows (preset or new custom label).
- Staff hits Import → server-side processes in a Vercel Function (rows < 10k → synchronous; rows ≥ 10k → background worker).
- Each row runs through dedup (§4).
- Final report: imported / matched / queued for review / errored.

The 8k legacy contacts are migrated this way on day one. Pre-flight: export legacy data from existing system → CSV per ministry stream → import with the right label.

---

## 12. Out of scope (v2 and v3)

**v2:** automated label-triggered welcome sequences, AND + field-filter segmentation (OR is in v1 per §5), A/B testing (manual winner pick), engagement scoring, per-label/segment analytics.

**v3:** WhatsApp via Twilio, advanced automations (date-based, inactivity, branching), in-app form builder UX polish, saved broadcast templates.

---

## 13. Migration order

| # | File | Contents |
|---|---|---|
| 041 | `041_crm_extend_contacts.sql` | ALTER contacts (+11 columns, triggers, indexes) |
| 042 | `042_crm_labels.sql` | sending_identities, labels, contact_labels |
| 043 | `043_crm_activity_events.sql` | activity_events table + trigger updating contacts.last_interaction_at |
| 044 | `044_crm_forms.sql` | forms, form_submissions |
| 045 | `045_crm_campaigns.sql` | campaigns, campaign_recipients |
| 046 | `046_crm_unsubscribes.sql` | unsubscribes, email_suppressions, sync triggers with contact_labels |
| 047 | `047_crm_dedup_queue.sql` | dedup_review_queue, csv_imports |
| 048 | `048_crm_permissions.sql` | Insert new permission rows |
| 049 | `049_crm_rls.sql` | RLS policies on all new tables |
| 050 | `050_crm_seed.sql` | Preset labels, default sending identities |
| 051 | `051_campaigns_multi_label.sql` | campaign_labels join, drop campaigns.label_id, rebuild v_campaign_audience keyed on campaign_id |

Each migration ends with a comment block listing what to verify in Supabase Table Editor. After 041–050 are applied, regenerate `src/types/database.ts`.

---

## 14. Open questions to revisit

- Preset label list: the user needs to enumerate the initial preset labels before migration 050. Until then, 050 seeds only the 1-2 obvious ones (e.g., `Donors`, `Newsletter`) and the rest are added via UI.
- Sending identity list: same — needs the user's final list (e.g., `the-send`, `ministry-night`, `schools`, `donors`, `general`).
- Welcome campaigns at form submission: v1 plumbing exists (forms.welcome_campaign_id column), but the auto-trigger logic is v2. v1 = manual sends only.
