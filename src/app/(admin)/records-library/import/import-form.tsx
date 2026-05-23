"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { useRouter } from "next/navigation";

type Template = {
  id: string;
  name: string;
  record_type: string;
  column_mapping: Record<string, string>;
};

type RecordType = "application" | "payment" | "enrollment" | "document";

const BATCH_SIZE = 100;

const PERSON_FIELDS = [
  "email",
  "first_name",
  "last_name",
  "preferred_name",
  "date_of_birth",
  "phone",
  "nationality",
  "country",
] as const;

const RECORD_FIELDS_BY_TYPE: Record<RecordType, readonly string[]> = {
  application: ["program_name", "cohort", "status", "submitted_at"],
  payment: ["amount", "currency", "description", "paid_at"],
  enrollment: ["school_name", "program_name", "role", "start_date", "end_date"],
  document: ["doc_type", "file_url", "identifier", "expires_at"],
};

const LABELS: Record<string, string> = {
  email: "Email",
  first_name: "First name",
  last_name: "Last name",
  preferred_name: "Preferred name",
  date_of_birth: "Date of birth",
  phone: "Phone",
  nationality: "Nationality",
  country: "Country",
  program_name: "Program name",
  cohort: "Cohort",
  status: "Status",
  submitted_at: "Submitted at",
  amount: "Amount",
  currency: "Currency",
  description: "Description",
  paid_at: "Paid at",
  school_name: "School name",
  role: "Role",
  start_date: "Start date",
  end_date: "End date",
  doc_type: "Document type",
  file_url: "File URL",
  identifier: "Identifier",
  expires_at: "Expires at",
};

function guessField(header: string, fields: readonly string[]): string {
  const h = header.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const candidates: Record<string, string> = {
    first_name: "first_name",
    firstname: "first_name",
    given_name: "first_name",
    last_name: "last_name",
    lastname: "last_name",
    surname: "last_name",
    family_name: "last_name",
    preferred_name: "preferred_name",
    nickname: "preferred_name",
    email: "email",
    email_address: "email",
    e_mail: "email",
    phone: "phone",
    phone_number: "phone",
    whatsapp_number: "phone",
    mobile: "phone",
    cell: "phone",
    date_of_birth: "date_of_birth",
    dob: "date_of_birth",
    birthdate: "date_of_birth",
    nationality: "nationality",
    nationality_passport_country: "nationality",
    passport_country: "nationality",
    country: "country",
    program: "program_name",
    program_name: "program_name",
    school: "school_name",
    school_name: "school_name",
    cohort: "cohort",
    term: "cohort",
    quarter: "cohort",
    status: "status",
    application_status: "status",
    submitted: "submitted_at",
    submitted_at: "submitted_at",
    amount: "amount",
    currency: "currency",
    description: "description",
    paid: "paid_at",
    paid_at: "paid_at",
    payment_date: "paid_at",
    start: "start_date",
    start_date: "start_date",
    end: "end_date",
    end_date: "end_date",
    role: "role",
    doc_type: "doc_type",
    document_type: "doc_type",
    file: "file_url",
    file_url: "file_url",
    url: "file_url",
    identifier: "identifier",
    number: "identifier",
    expires: "expires_at",
    expires_at: "expires_at",
    expiration_date: "expires_at",
    expiry_date: "expires_at",
  };
  const guess = candidates[h];
  if (guess && fields.includes(guess)) return guess;
  // Person fields are always valid alongside record fields.
  if (guess && (PERSON_FIELDS as readonly string[]).includes(guess)) return guess;
  return "";
}

type Stage = "idle" | "parsed" | "uploading" | "complete" | "failed";

export function ImportForm({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [stage, setStage] = useState<Stage>("idle");
  const [recordType, setRecordType] = useState<RecordType>("application");
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [templateId, setTemplateId] = useState<string>("");
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<{
    persons_created: number;
    records_created: number;
    auto_linked: number;
    queued: number;
    error_count: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const availableFields = useMemo(() => {
    return [...PERSON_FIELDS, ...RECORD_FIELDS_BY_TYPE[recordType]];
  }, [recordType]);

  const hasEmailMapping = useMemo(() => {
    return Object.values(mapping).includes("email");
  }, [mapping]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFilename(f.name);
    setErrorMessage(null);
    setResult(null);

    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (parsed) => {
        const parsedHeaders = (parsed.meta.fields ?? []).filter(Boolean);
        const parsedRows = parsed.data;
        setHeaders(parsedHeaders);
        setRows(parsedRows);

        const fields = [...PERSON_FIELDS, ...RECORD_FIELDS_BY_TYPE[recordType]];
        const guessed: Record<string, string> = {};
        for (const h of parsedHeaders) guessed[h] = guessField(h, fields);
        setMapping(guessed);

        setStage("parsed");
      },
      error: (err) => {
        setErrorMessage(`Failed to parse CSV: ${err.message}`);
        setStage("idle");
      },
    });
  }

  function applyTemplate(id: string) {
    setTemplateId(id);
    if (!id) return;
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setRecordType(t.record_type as RecordType);
    // Only apply mapping entries whose CSV column is in the current file.
    const next: Record<string, string> = {};
    for (const h of headers) {
      next[h] = t.column_mapping[h] ?? "";
    }
    setMapping(next);
  }

  function changeRecordType(rt: RecordType) {
    setRecordType(rt);
    // Re-guess based on the new field set.
    const fields = [...PERSON_FIELDS, ...RECORD_FIELDS_BY_TYPE[rt]];
    const next: Record<string, string> = {};
    for (const h of headers) next[h] = guessField(h, fields);
    setMapping(next);
  }

  async function startImport() {
    if (!hasEmailMapping) {
      setErrorMessage(
        "Map at least one column to 'email' — it's the primary matching key."
      );
      return;
    }

    setStage("uploading");
    setErrorMessage(null);
    setProgress({ done: 0, total: rows.length });
    setResult({
      persons_created: 0,
      records_created: 0,
      auto_linked: 0,
      queued: 0,
      error_count: 0,
    });

    // 1. Optionally save the template first so the import row can reference it.
    let savedTemplateId: string | null = templateId || null;
    if (saveAsTemplate && templateName.trim()) {
      const tRes = await fetch("/api/records-library/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName.trim(),
          record_type: recordType,
          column_mapping: mapping,
        }),
      });
      if (tRes.ok) {
        const { template } = await tRes.json();
        savedTemplateId = template.id;
      }
    }

    // 2. Create the import row.
    const createRes = await fetch("/api/records-library/imports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename,
        record_type: recordType,
        column_mapping: mapping,
        row_count: rows.length,
        template_id: savedTemplateId,
      }),
    });
    if (!createRes.ok) {
      const err = await safeJson(createRes);
      setErrorMessage(err.error ?? "Failed to create import");
      setStage("failed");
      return;
    }
    const { import: importRow } = (await createRes.json()) as {
      import: { id: string };
    };
    const importId = importRow.id;

    // 3. Upload in batches.
    const totals = {
      persons_created: 0,
      records_created: 0,
      auto_linked: 0,
      queued: 0,
      error_count: 0,
    };
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const res = await fetch(
        `/api/records-library/imports/${importId}/rows`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: batch }),
        }
      );
      if (!res.ok) {
        const err = await safeJson(res);
        setErrorMessage(err.error ?? "Batch failed");
        await fetch(`/api/records-library/imports/${importId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ failed: true, errorLog: { message: err.error } }),
        });
        setStage("failed");
        return;
      }
      const result = await res.json();
      totals.persons_created += result.persons_created;
      totals.records_created += result.records_created;
      totals.error_count += result.error_count;
      setResult({ ...totals });
      setProgress({ done: i + batch.length, total: rows.length });
    }

    // 4. Mark complete (and trigger matching).
    const completeRes = await fetch(
      `/api/records-library/imports/${importId}/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );
    if (completeRes.ok) {
      const completeData = await completeRes.json();
      totals.auto_linked = completeData.auto_linked ?? 0;
      totals.queued = completeData.queued ?? 0;
      setResult({ ...totals });
    }

    setStage("complete");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="border rounded-md p-4 space-y-3">
        <h2 className="font-semibold">1. Record type</h2>
        <p className="text-xs text-muted-foreground">
          What kind of record does each row represent? You can save the mapping
          as a template at the end and re-use it for the next upload.
        </p>
        <div className="flex gap-2 flex-wrap">
          {(["application", "payment", "enrollment", "document"] as RecordType[]).map(
            (rt) => (
              <button
                key={rt}
                type="button"
                onClick={() => changeRecordType(rt)}
                disabled={stage === "uploading"}
                className={`px-3 py-1.5 text-sm rounded-md border capitalize ${
                  recordType === rt
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-card text-foreground hover:bg-muted"
                }`}
              >
                {rt}
              </button>
            )
          )}
        </div>
        {templates.length > 0 && (
          <div className="pt-2">
            <label className="block text-xs text-muted-foreground mb-1">
              Or load a saved template
            </label>
            <select
              value={templateId}
              onChange={(e) => applyTemplate(e.target.value)}
              disabled={stage === "uploading"}
              className="border rounded-md px-2 py-1 text-sm"
            >
              <option value="">— None —</option>
              {templates
                .filter((t) => t.record_type === recordType)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>
        )}
      </section>

      <section className="border rounded-md p-4">
        <h2 className="font-semibold mb-2">2. Choose CSV file</h2>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="text-sm"
          disabled={stage === "uploading"}
        />
        {filename && (
          <p className="text-xs text-muted-foreground mt-1">
            {filename} — {rows.length.toLocaleString()} rows parsed
          </p>
        )}
      </section>

      {stage !== "idle" && headers.length > 0 && (
        <section className="border rounded-md p-4">
          <h2 className="font-semibold mb-2">3. Map columns</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Required: map a column to <code>email</code>. Anything you leave
            unmapped is stored in raw payload.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-2">
            {headers.map((h) => (
              <div key={h} className="flex items-center gap-2 text-sm">
                <span
                  className="font-mono text-xs text-muted-foreground flex-1 truncate"
                  title={h}
                >
                  {h}
                </span>
                <select
                  value={mapping[h] ?? ""}
                  onChange={(e) =>
                    setMapping((prev) => ({ ...prev, [h]: e.target.value }))
                  }
                  disabled={stage === "uploading"}
                  className="border rounded-md px-2 py-1 text-xs min-w-[160px]"
                >
                  <option value="">— Raw only —</option>
                  <optgroup label="Person fields">
                    {PERSON_FIELDS.map((f) => (
                      <option key={f} value={f}>
                        {LABELS[f] ?? f}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Record fields">
                    {RECORD_FIELDS_BY_TYPE[recordType].map((f) => (
                      <option key={f} value={f}>
                        {LABELS[f] ?? f}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            ))}
          </div>
        </section>
      )}

      {stage !== "idle" && (
        <section className="border rounded-md p-4 space-y-2">
          <h2 className="font-semibold">4. Save as template (optional)</h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={saveAsTemplate}
              onChange={(e) => setSaveAsTemplate(e.target.checked)}
              disabled={stage === "uploading"}
            />
            Save this mapping so I can reuse it
          </label>
          {saveAsTemplate && (
            <input
              type="text"
              placeholder="Template name (e.g. Leadership Track Q4/2026)"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              disabled={stage === "uploading"}
              className="border rounded-md px-2 py-1 text-sm w-full max-w-md"
            />
          )}
        </section>
      )}

      {errorMessage && (
        <div className="border border-red-500/40 bg-red-500/10 text-red-300 rounded-md p-3 text-sm">
          {errorMessage}
        </div>
      )}

      {result && (
        <div className="border rounded-md p-4 bg-muted/50">
          <h3 className="font-semibold mb-2 text-sm">
            {stage === "complete" ? "Import complete" : "Progress"}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
            <Stat label="Persons created" value={result.persons_created} />
            <Stat label="Records created" value={result.records_created} />
            <Stat label="Auto-linked" value={result.auto_linked} />
            <Stat label="Queued" value={result.queued} />
            <Stat label="Errors" value={result.error_count} />
          </div>
          {stage === "uploading" && (
            <p className="text-xs text-muted-foreground mt-2">
              Processed {progress.done.toLocaleString()} / {progress.total.toLocaleString()}
            </p>
          )}
        </div>
      )}

      {stage === "parsed" && (
        <button
          type="button"
          onClick={startImport}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          Start import
        </button>
      )}

      {stage === "complete" && (
        <button
          type="button"
          onClick={() => router.push("/records-library")}
          className="px-4 py-2 border rounded-md text-sm hover:bg-muted"
        >
          Back to Records Library
        </button>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value.toLocaleString()}</div>
    </div>
  );
}

async function safeJson(res: Response): Promise<{ error?: string }> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}
