-- ============================================================
-- Consent agreements + records (POPIA compliance scaffolding)
-- ------------------------------------------------------------
-- Stores the versioned privacy / data-processing agreement text
-- and an immutable audit record of every acceptance event.
--
-- Acceptance happens in two places today:
--   - public application submission (applicant_email + application_id)
--   - onboarding completion         (user_id)
--
-- The seed below populates an initial agreement (v1). When the text
-- changes materially, insert a new row with a new version and set
-- is_current = true (the partial unique index keeps "one current" honest).
-- ============================================================

CREATE TABLE public.consent_agreements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version       text NOT NULL UNIQUE,
  title         text NOT NULL,
  body_markdown text NOT NULL,
  effective_at  timestamptz NOT NULL DEFAULT now(),
  is_current    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Only one row may have is_current = true at any time.
CREATE UNIQUE INDEX consent_agreements_only_one_current
  ON public.consent_agreements (is_current) WHERE is_current = true;

CREATE TABLE public.consent_records (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_version text NOT NULL REFERENCES public.consent_agreements(version),
  user_id           uuid REFERENCES public.users(id) ON DELETE SET NULL,
  applicant_email   text,
  application_id    uuid REFERENCES public.application_responses(id) ON DELETE SET NULL,
  source            text NOT NULL CHECK (source IN ('application', 'onboarding')),
  ip_address        text,
  user_agent        text,
  accepted_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR applicant_email IS NOT NULL)
);

CREATE INDEX idx_consent_records_user        ON public.consent_records(user_id);
CREATE INDEX idx_consent_records_email       ON public.consent_records(applicant_email);
CREATE INDEX idx_consent_records_application ON public.consent_records(application_id);
CREATE INDEX idx_consent_records_version     ON public.consent_records(agreement_version);

-- RLS
ALTER TABLE public.consent_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records    ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. unauthenticated public applicants) can read the agreement.
CREATE POLICY "Anyone can read consent agreements"
  ON public.consent_agreements FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage consent agreements"
  ON public.consent_agreements FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Inserts: open (the API enforces correctness). Reads: self or admin.
CREATE POLICY "Anyone can insert consent records"
  ON public.consent_records FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can read own consent records"
  ON public.consent_records FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all consent records"
  ON public.consent_records FOR SELECT
  USING (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- SEED v1 agreement
-- ────────────────────────────────────────────────────────────
INSERT INTO public.consent_agreements (version, title, body_markdown, is_current)
VALUES (
  'v1.0-2026-05-17',
  'FFSA Hub — Privacy & Data Processing Agreement',
$body$# FFSA Hub — Privacy & Data Processing Agreement

**Version:** v1.0 — 17 May 2026

This agreement explains how Fire and Fragrance South Africa NPC ("**FFSA**", "we", "us") collects, stores, and uses your personal information when you apply to one of our programs, create an account on FFSA Hub, or otherwise interact with us. By ticking the consent box, you agree to the terms below.

We process your personal information in accordance with the Protection of Personal Information Act, 2013 ("**POPIA**").

## 1. Who we are

Fire and Fragrance South Africa NPC is a registered non-profit company running training schools (DTS, DBS, SBS, Leadership Track, LEAD, FFX), outreach campaigns, and ministry programs in and from South Africa. We are the responsible party (data controller) for the personal information you provide to us through FFSA Hub.

You can contact us about your information at: **info@fireandfragrance.com**.

## 2. What information we collect

Depending on what you do on FFSA Hub, we may collect the following categories of personal information:

**Identity & contact.** Name, preferred name, email address, phone number, date of birth, gender, marital status, nationality, residential address (including city, province, country, and postal code), and any profile photo you choose to upload.

**Travel & immigration (where applicable).** Passport country, passport number, visa category, visa type, and visa expiry date — collected only when you indicate that you are an international applicant or staff member.

**Emergency contact.** The name, phone number, and relationship of an emergency contact you nominate.

**Health information.** Your medical aid / health insurance provider, policy number, and expiry date; and any health-related information you choose to share with us in application questions (for example, current medication or relevant medical history).

**Application content.** Your written answers to program application questions, including testimony, personal history, calling, and any other information you provide. Application questions may include questions of a sensitive nature (for example, declarations about prior criminal convictions, addictions, or your spiritual journey). You choose what to disclose.

**References.** The names and email addresses of referees you nominate. We contact those referees to request a written reference, which we then store as part of your application record. The reference itself includes the referee's assessment of your character, spiritual journey, and suitability for the program.

**Uploaded documents.** Photos, identification documents, certificates, receipts, and any other files you upload as part of an application, your profile, or a finance record.

**Financial information.** For paying students and outreach participants: payment amounts, dates, methods, currencies, and reference numbers relating to school fees or outreach contributions. We do not store full credit-card or bank-account details — payments are processed by our integrations (see section 5).

**Account & usage data.** Login times, IP address at the moment you accept this agreement, the version of this agreement you accepted, and basic technical information needed to operate the platform securely.

## 3. Why we collect it

We use your information to:

- Process and assess your application to one of our programs.
- Contact the referees you nominate and gather their references.
- Administer your enrolment, attendance, accommodation, fees, and graduation.
- Send you communications about your application status, programs you are enrolled in, prayer requests, ministry opportunities, FFSA news, donation appeals, and other updates from Fire and Fragrance South Africa.
- Coordinate outreach trips, including travel logistics where you participate.
- Issue invoices and receipts where school fees or contributions are payable, and reconcile our accounting records.
- Comply with legal, regulatory, and statutory obligations (including immigration, child-safety, tax, and accounting law).
- Maintain safety on our schools and outreaches, including access to your emergency contact and any health information that may be relevant in an emergency.

## 4. Who can see it

Inside FFSA, your information is accessible to:

- Authorised FFSA staff and administrators with a legitimate operational need (for example, finance staff, school administrators, communications staff).
- The leaders and team leaders of programs and outreaches you are involved in.

We do **not** sell your personal information. We do **not** share it with third parties for their own marketing purposes.

## 5. Service providers we use

We rely on trusted third-party service providers to operate FFSA Hub. They process your information on our behalf, under contractual obligations to keep it confidential:

- **Supabase** — database, authentication, and file storage. Stores your account and application data.
- **Resend** — transactional and broadcast email. Sends emails on our behalf (account invites, application confirmations, reference requests, newsletters).
- **Xero** — accounting and invoicing. We share your name, email, and invoice line items where school fees or contributions apply.
- **Vercel** — hosting and content delivery for FFSA Hub itself.

If we add new service providers that process your personal information, we will update this agreement and, where required, ask for renewed consent.

## 6. International transfers

Some of our service providers (notably Supabase, Resend, and Vercel) operate data centres outside of South Africa. By accepting this agreement, you consent to your personal information being processed in jurisdictions outside South Africa, including where our providers store data redundantly.

## 7. How long we keep it

- **Active applicants and enrolled students:** for as long as you are engaged with one of our programs, plus a further retention period afterwards (currently seven (7) years) so that we can verify enrolment, alumni status, and respond to queries from you, referees, or relevant authorities.
- **Rejected, withdrawn, or unsuccessful applications:** retained for two (2) years to handle re-applications and follow-up inquiries, after which they are archived or anonymised.
- **Financial records:** retained for the period required by South African tax and accounting law (currently five (5) years from the end of the relevant tax year).
- **Reference responses:** retained alongside the application they relate to, for the same retention period as that application.
- **Consent records (this agreement):** retained for as long as we hold any of your personal information, plus a further seven (7) years, so that we can demonstrate the basis on which we processed it.

After these periods we will either delete your personal information or anonymise it so that it can no longer be linked to you.

## 8. Your rights under POPIA

You have the right to:

- **Access** the personal information we hold about you.
- **Correct** it if it is inaccurate, outdated, incomplete, or misleading.
- **Object** to certain types of processing in particular circumstances.
- **Request deletion** of your personal information where we no longer have a lawful reason to keep it. Some information must be retained to meet legal obligations (for example, financial records under tax law).
- **Withdraw your consent** at any time, by writing to us at the email address in section 1. Withdrawing consent does not affect the lawfulness of any processing we carried out before you withdrew, and may affect our ability to keep you in a program.
- **Lodge a complaint** with the Information Regulator of South Africa if you believe we have not handled your personal information properly. Their website is https://inforegulator.org.za.

To exercise any of these rights, please contact us at the email address in section 1.

## 9. Special categories of information

Some information we collect — including health and medical details, religious or spiritual reflection, and any disclosures about prior criminal convictions — is treated as "special personal information" under POPIA. We process this information only with your consent, and only for the purposes set out in section 3.

## 10. Applicants under 18

If you are 16 or 17 years old, you are old enough to apply to our programs, but we may also ask for your parent or guardian's consent to process your personal information before continuing.

We do not knowingly collect personal information from anyone under the age of 16.

## 11. Security

We rely on the security features built into our service providers, including encrypted connections, role-based access control, and row-level security in our database. While no system is perfectly secure, we take reasonable steps to protect your information from unauthorised access, loss, or disclosure.

## 12. Changes to this agreement

We may update this agreement from time to time. If we make material changes, we will ask you to accept the new version the next time you sign in or apply. The version you accepted is recorded in our audit log and is shown at the top of this page.

---

**By ticking the consent box on the application form or during onboarding, you confirm that:**

1. You have read and understood this agreement.
2. You consent to FFSA collecting, storing, and using your personal information as described above, including the categories of "special personal information" identified in section 9.
3. You consent to receiving communications from FFSA as described in section 3 — including program updates, ministry news, prayer requests, and donation appeals — and understand you can unsubscribe from non-essential communications at any time.
4. You understand that you may withdraw your consent at any time by contacting us, subject to the limitations in sections 7 and 8.
$body$,
  true
);
