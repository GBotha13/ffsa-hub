// Run with: npx tsx scripts/seed-ffbx-template.ts
// Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envFile = readFileSync(resolve(__dirname, "../.env.local"), "utf-8");
const env: Record<string, string> = {};
for (const line of envFile.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const TEMPLATE_NAME = "FFBX Standard Application";
const TEMPLATE_DESC = "Standard application form for Fire & Fragrance Bible Experience programs";

const QUESTIONS = [
  { label: "First Name", type: "short_answer", is_required: true, options: [] },
  { label: "Preferred Name", type: "short_answer", is_required: false, options: [] },
  { label: "Last Name / Surname", type: "short_answer", is_required: true, options: [] },
  { label: "Whatsapp Number", type: "phone", is_required: true, options: [] },
  { label: "Email", type: "email", is_required: true, options: [] },
  { label: "Date of Birth", type: "date", is_required: true, options: [] },
  {
    label: "Gender",
    type: "multiple_choice",
    is_required: true,
    options: ["Male", "Female"],
  },
  { label: "Street Address", type: "short_answer", is_required: true, options: [] },
  { label: "City", type: "short_answer", is_required: true, options: [] },
  { label: "Province/State", type: "short_answer", is_required: false, options: [] },
  { label: "Country", type: "country", is_required: true, options: [] },
  { label: "Where did you do your DTS?", type: "long_answer", is_required: true, options: [] },
  { label: "Nationality/Passport Country", type: "country", is_required: true, options: [] },
  { label: "Do you have a valid passport?", type: "yes_no", is_required: true, options: [] },
  {
    label: "Are you currently on any medication? If yes, please list your medication.",
    type: "long_answer",
    is_required: false,
    options: [],
  },
  { label: "Emergency Contact Name", type: "short_answer", is_required: true, options: [] },
  {
    label: "Emergency Contact Relationship",
    type: "multiple_choice",
    is_required: true,
    options: ["Parent", "Spouse", "Sibling", "Friend", "Pastor/Leader", "Other"],
  },
  { label: "Emergency Contact Email", type: "email", is_required: true, options: [] },
  {
    label: "Emergency Contact Phone Number (include country code)",
    type: "short_answer",
    is_required: true,
    options: [],
  },
];

async function main() {
  // Create template
  const { data: template, error: tErr } = await supabase
    .from("application_templates")
    .insert({ name: TEMPLATE_NAME, description: TEMPLATE_DESC })
    .select()
    .single();

  if (tErr) {
    console.error("Failed to create template:", tErr.message);
    process.exit(1);
  }

  console.log(`Created template: ${template.id} — ${TEMPLATE_NAME}`);

  // Create questions
  const rows = QUESTIONS.map((q, i) => ({
    template_id: template.id,
    label: q.label,
    description: null,
    type: q.type,
    sort_order: i,
    is_required: q.is_required,
    options: q.options,
  }));

  const { error: qErr } = await supabase
    .from("application_template_questions")
    .insert(rows);

  if (qErr) {
    console.error("Failed to insert questions:", qErr.message);
    process.exit(1);
  }

  console.log(`Inserted ${rows.length} questions into template`);
  console.log("Done! You can now import this template from the admin panel.");
}

main();
