"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateUserProfile, completeOnboarding } from "@/services/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";

const TOTAL_STEPS = 5;

const STEP_LABELS = [
  "Password",
  "Personal",
  "Address",
  "Passport",
  "Emergency",
];

interface FormData {
  first_name: string;
  last_name: string;
  preferred_name: string;
  date_of_birth: string;
  gender: string;
  marital_status: string;
  nationality: string;
  phone: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  province: string;
  country: string;
  postal_code: string;
  is_international: boolean;
  passport_country: string;
  passport_number: string;
  visa_category: string;
  visa_type: string;
  visa_expiry_date: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  health_insurance_provider: string;
  health_insurance_policy_number: string;
  health_insurance_expiry_date: string;
}

const EMPTY_FORM: FormData = {
  first_name: "", last_name: "", preferred_name: "",
  date_of_birth: "", gender: "", marital_status: "",
  nationality: "", phone: "",
  address_line_1: "", address_line_2: "", city: "",
  province: "", country: "", postal_code: "",
  is_international: false, passport_country: "", passport_number: "",
  visa_category: "", visa_type: "", visa_expiry_date: "",
  emergency_contact_name: "", emergency_contact_phone: "",
  emergency_contact_relationship: "", health_insurance_provider: "",
  health_insurance_policy_number: "", health_insurance_expiry_date: "",
};

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSet, setPasswordSet] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push("/login"); return; }
      setUserId(authUser.id);

      const { data: appUser } = await (supabase as any)
        .from("users").select("*").eq("id", authUser.id).single();
      if (!appUser) { router.push("/login"); return; }

      if (appUser.accepted_at) {
        const { data: roles } = await (supabase as any)
          .from("user_roles").select("roles(name)").eq("user_id", authUser.id);
        const adminRoles = ["super_admin","admin","events_admin","program_leader","team_leader","staff","finance_admin","comms_admin","mission_leader"];
        const roleNames = (roles ?? []).flatMap((r: any) =>
          Array.isArray(r.roles) ? r.roles.map((x: any) => x.name) : r.roles ? [r.roles.name] : []
        );
        router.push(roleNames.some((r: string) => adminRoles.includes(r)) ? "/dashboard" : "/profile");
        return;
      }

      setForm({
        first_name: appUser.first_name ?? "", last_name: appUser.last_name ?? "",
        preferred_name: appUser.preferred_name ?? "", date_of_birth: appUser.date_of_birth ?? "",
        gender: appUser.gender ?? "", marital_status: appUser.marital_status ?? "",
        nationality: appUser.nationality ?? "", phone: appUser.phone ?? "",
        address_line_1: appUser.address_line_1 ?? "", address_line_2: appUser.address_line_2 ?? "",
        city: appUser.city ?? "", province: appUser.province ?? "",
        country: appUser.country ?? "", postal_code: appUser.postal_code ?? "",
        is_international: appUser.is_international ?? false,
        passport_country: appUser.passport_country ?? "", passport_number: appUser.passport_number ?? "",
        visa_category: appUser.visa_category ?? "", visa_type: appUser.visa_type ?? "",
        visa_expiry_date: appUser.visa_expiry_date ?? "",
        emergency_contact_name: appUser.emergency_contact_name ?? "",
        emergency_contact_phone: appUser.emergency_contact_phone ?? "",
        emergency_contact_relationship: appUser.emergency_contact_relationship ?? "",
        health_insurance_provider: appUser.health_insurance_provider ?? "",
        health_insurance_policy_number: appUser.health_insurance_policy_number ?? "",
        health_insurance_expiry_date: appUser.health_insurance_expiry_date ?? "",
      });

      setLoading(false);
    }
    loadUser();
  }, []);

  function set(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }
  function nullify(val: string) { return val.trim() === "" ? null : val.trim(); }

  async function handleFinish() {
    if (!userId) return;
    setSaving(true); setError(null);
    try {
      const { error: profileError } = await updateUserProfile(supabase, userId, {
        first_name: form.first_name.trim(), last_name: form.last_name.trim(),
        preferred_name: nullify(form.preferred_name), date_of_birth: nullify(form.date_of_birth),
        gender: nullify(form.gender), marital_status: nullify(form.marital_status),
        nationality: nullify(form.nationality), phone: nullify(form.phone),
        address_line_1: nullify(form.address_line_1), address_line_2: nullify(form.address_line_2),
        city: nullify(form.city), province: nullify(form.province),
        country: nullify(form.country), postal_code: nullify(form.postal_code),
        is_international: form.is_international,
        passport_country: form.is_international ? nullify(form.passport_country) : null,
        passport_number: form.is_international ? nullify(form.passport_number) : null,
        visa_category: form.is_international ? nullify(form.visa_category) : null,
        visa_type: form.is_international && form.visa_category === "long_term" ? nullify(form.visa_type) : null,
        visa_expiry_date: form.is_international && form.visa_category === "long_term" ? nullify(form.visa_expiry_date) : null,
        emergency_contact_name: nullify(form.emergency_contact_name),
        emergency_contact_phone: nullify(form.emergency_contact_phone),
        emergency_contact_relationship: nullify(form.emergency_contact_relationship),
        health_insurance_provider: nullify(form.health_insurance_provider),
        health_insurance_policy_number: nullify(form.health_insurance_policy_number),
        health_insurance_expiry_date: nullify(form.health_insurance_expiry_date),
      });
      if (profileError) throw new Error(profileError.message);
      await completeOnboarding(supabase, userId);
      const { data: roles } = await (supabase as any)
        .from("user_roles").select("roles(name)").eq("user_id", userId);
      const adminRoles = ["super_admin","admin","events_admin","program_leader","team_leader","staff","finance_admin","comms_admin","mission_leader"];
      const roleNames = (roles ?? []).flatMap((r: any) =>
        Array.isArray(r.roles) ? r.roles.map((x: any) => x.name) : r.roles ? [r.roles.name] : []
      );
      router.push(roleNames.some((r: string) => adminRoles.includes(r)) ? "/dashboard" : "/profile");
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#0D0B09" }}>
        <p style={{ color: "var(--text-tertiary)", letterSpacing: "0.2em", fontSize: "11px", textTransform: "uppercase" }}>
          Loading…
        </p>
      </div>
    );
  }

  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#0D0B09" }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-8 py-5"
        style={{ borderBottom: "1px solid hsl(22 8% 12%)" }}
      >
        <div className="flex items-center gap-3">
          <Image src="/ff-logo.png" alt="Fire & Fragrance" width={100} height={26} style={{ objectFit: "contain" }} priority />
          <div style={{ height: "1px", width: "12px", background: "var(--yellow)" }} />
          <span style={{ fontSize: "8px", letterSpacing: "0.3em", fontWeight: 700, color: "var(--yellow)", textTransform: "uppercase" }}>
            HUB
          </span>
        </div>
        <p style={{ fontSize: "10px", letterSpacing: "0.2em", color: "var(--text-tertiary)", textTransform: "uppercase" }}>
          Account Setup
        </p>
      </div>

      {/* Step indicator */}
      <div style={{ borderBottom: "1px solid hsl(22 8% 12%)" }}>
        <div className="flex">
          {STEP_LABELS.map((label, i) => {
            const stepNum = i + 1;
            const isDone = step > stepNum;
            const isActive = step === stepNum;
            return (
              <div
                key={label}
                className="flex-1 flex flex-col items-center py-3 gap-1"
                style={{
                  borderBottom: isActive ? `2px solid var(--yellow)` : isDone ? `2px solid hsl(42 95% 55% / 0.35)` : `2px solid transparent`,
                }}
              >
                <span
                  style={{
                    fontSize: "9px",
                    letterSpacing: "0.2em",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: isActive ? "var(--yellow)" : isDone ? "hsl(42 95% 55% / 0.55)" : "var(--text-tertiary)",
                  }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
        {/* Thin yellow progress fill */}
        <div style={{ height: "1px", background: "var(--surface-3)", position: "relative" }}>
          <div
            style={{
              position: "absolute", top: 0, left: 0, height: "100%",
              width: `${progress}%`,
              background: "var(--yellow)",
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-lg">

          {/* Step card */}
          <div
            style={{
              background: "hsl(22 10% 8%)",
              border: "1px solid hsl(22 8% 14%)",
              borderRadius: "16px",
              overflow: "hidden",
            }}
          >
            {/* Card header */}
            <div style={{ padding: "1.75rem 2rem 1.25rem", borderBottom: "1px solid hsl(22 8% 12%)" }}>
              {step === 1 && <>
                <p className="page-eyebrow" style={{ marginBottom: "6px" }}>Step 1 of {TOTAL_STEPS}</p>
                <h2 style={{ fontFamily: "var(--font-bebas,'Arial Black',sans-serif)", fontSize: "2rem", letterSpacing: "0.04em", color: "#F0EBE3", lineHeight: 1 }}>
                  Set Your Password
                </h2>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>Create a secure password to log in later.</p>
              </>}
              {step === 2 && <>
                <p className="page-eyebrow" style={{ marginBottom: "6px" }}>Step 2 of {TOTAL_STEPS}</p>
                <h2 style={{ fontFamily: "var(--font-bebas,'Arial Black',sans-serif)", fontSize: "2rem", letterSpacing: "0.04em", color: "#F0EBE3", lineHeight: 1 }}>
                  Personal Information
                </h2>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>Tell us about yourself. Fields marked * are required.</p>
              </>}
              {step === 3 && <>
                <p className="page-eyebrow" style={{ marginBottom: "6px" }}>Step 3 of {TOTAL_STEPS}</p>
                <h2 style={{ fontFamily: "var(--font-bebas,'Arial Black',sans-serif)", fontSize: "2rem", letterSpacing: "0.04em", color: "#F0EBE3", lineHeight: 1 }}>
                  Address
                </h2>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>Your current address or on-base address.</p>
              </>}
              {step === 4 && <>
                <p className="page-eyebrow" style={{ marginBottom: "6px" }}>Step 4 of {TOTAL_STEPS}</p>
                <h2 style={{ fontFamily: "var(--font-bebas,'Arial Black',sans-serif)", fontSize: "2rem", letterSpacing: "0.04em", color: "#F0EBE3", lineHeight: 1 }}>
                  Passport &amp; Visa
                </h2>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>Only for international staff. Local South Africans can skip.</p>
              </>}
              {step === 5 && <>
                <p className="page-eyebrow" style={{ marginBottom: "6px" }}>Step 5 of {TOTAL_STEPS}</p>
                <h2 style={{ fontFamily: "var(--font-bebas,'Arial Black',sans-serif)", fontSize: "2rem", letterSpacing: "0.04em", color: "#F0EBE3", lineHeight: 1 }}>
                  Emergency &amp; Health
                </h2>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>Emergency contact and health insurance details.</p>
              </>}
            </div>

            {/* Card body */}
            <div style={{ padding: "1.5rem 2rem" }} className="space-y-4">

              {/* ── Step 1: Password ── */}
              {step === 1 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="password">New Password *</Label>
                    <Input id="password" type="password" placeholder="At least 6 characters"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      required disabled={passwordSet} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm_password">Confirm Password *</Label>
                    <Input id="confirm_password" type="password" placeholder="Re-enter your password"
                      value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                      required disabled={passwordSet} />
                  </div>
                  {passwordSet && (
                    <p style={{ fontSize: "12px", color: "hsl(142 55% 58%)", fontWeight: 600 }}>
                      ✓ Password set successfully!
                    </p>
                  )}
                </>
              )}

              {/* ── Step 2: Personal Info ── */}
              {step === 2 && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">First Name *</Label>
                      <Input id="first_name" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Last Name *</Label>
                      <Input id="last_name" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="preferred_name">Preferred Name</Label>
                    <Input id="preferred_name" placeholder="What you like to be called" value={form.preferred_name} onChange={(e) => set("preferred_name", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="date_of_birth">Date of Birth</Label>
                      <Input id="date_of_birth" type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gender">Gender</Label>
                      <Input id="gender" placeholder="e.g. Male, Female" value={form.gender} onChange={(e) => set("gender", e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="marital_status">Marital Status</Label>
                      <select id="marital_status" value={form.marital_status} onChange={(e) => set("marital_status", e.target.value)}
                        className="flex h-10 w-full rounded-md px-3 py-2 text-sm">
                        <option value="">Select…</option>
                        <option value="single">Single</option>
                        <option value="married">Married</option>
                        <option value="divorced">Divorced</option>
                        <option value="widowed">Widowed</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nationality">Nationality</Label>
                      <Input id="nationality" placeholder="e.g. South African" value={form.nationality} onChange={(e) => set("nationality", e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" type="tel" placeholder="+27 71 234 5678" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                  </div>
                </>
              )}

              {/* ── Step 3: Address ── */}
              {step === 3 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="address_line_1">Address Line 1</Label>
                    <Input id="address_line_1" placeholder="Street address" value={form.address_line_1} onChange={(e) => set("address_line_1", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address_line_2">Address Line 2</Label>
                    <Input id="address_line_2" placeholder="Apartment, unit, building (optional)" value={form.address_line_2} onChange={(e) => set("address_line_2", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input id="city" placeholder="e.g. Potchefstroom" value={form.city} onChange={(e) => set("city", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="province">Province / State</Label>
                      <Input id="province" placeholder="e.g. North West" value={form.province} onChange={(e) => set("province", e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input id="country" placeholder="e.g. South Africa" value={form.country} onChange={(e) => set("country", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postal_code">Postal Code</Label>
                      <Input id="postal_code" placeholder="e.g. 2520" value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} />
                    </div>
                  </div>
                </>
              )}

              {/* ── Step 4: Passport & Visa ── */}
              {step === 4 && (
                <>
                  <label
                    className="flex items-center gap-3 cursor-pointer rounded-xl p-4"
                    style={{ border: "1px solid var(--surface-4)", background: "var(--surface-1)" }}
                  >
                    <input type="checkbox" checked={form.is_international}
                      onChange={(e) => setForm((prev) => ({
                        ...prev, is_international: e.target.checked,
                        ...(!e.target.checked && { passport_country: "", passport_number: "", visa_category: "", visa_type: "", visa_expiry_date: "" }),
                      }))}
                      className="h-4 w-4"
                    />
                    <div>
                      <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>I am an international staff member or visitor</p>
                      <p style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Check this if you are not a South African citizen</p>
                    </div>
                  </label>

                  {form.is_international && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="passport_country">Passport Country</Label>
                          <Input id="passport_country" placeholder="e.g. United States" value={form.passport_country} onChange={(e) => set("passport_country", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="passport_number">Passport Number</Label>
                          <Input id="passport_number" placeholder="e.g. A12345678" value={form.passport_number} onChange={(e) => set("passport_number", e.target.value)} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Visa Status</Label>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { value: "90_day", label: "90-Day Visa", sub: "Short-term visitor" },
                            { value: "long_term", label: "Long-Term Visa", sub: "Work, study, or religious" },
                          ].map((opt) => (
                            <label
                              key={opt.value}
                              className="flex items-center gap-3 cursor-pointer rounded-xl p-3"
                              style={{
                                border: `1px solid ${form.visa_category === opt.value ? "var(--yellow-border)" : "var(--surface-4)"}`,
                                background: form.visa_category === opt.value ? "var(--yellow-dim)" : "var(--surface-1)",
                              }}
                            >
                              <input type="radio" name="visa_category" value={opt.value}
                                checked={form.visa_category === opt.value}
                                onChange={() => setForm((prev) => ({ ...prev, visa_category: opt.value, visa_type: "", visa_expiry_date: "" }))}
                                className="h-4 w-4" />
                              <div>
                                <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>{opt.label}</p>
                                <p style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>{opt.sub}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      {form.visa_category === "long_term" && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="visa_type">Visa Type</Label>
                            <Input id="visa_type" placeholder="e.g. Religious, Study" value={form.visa_type} onChange={(e) => set("visa_type", e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="visa_expiry_date">Visa Expiry Date</Label>
                            <Input id="visa_expiry_date" type="date" value={form.visa_expiry_date} onChange={(e) => set("visa_expiry_date", e.target.value)} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ── Step 5: Emergency & Health ── */}
              {step === 5 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
                    <Input id="emergency_contact_name" placeholder="Full name" value={form.emergency_contact_name} onChange={(e) => set("emergency_contact_name", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="emergency_contact_phone">Phone</Label>
                      <Input id="emergency_contact_phone" type="tel" placeholder="+27 71 234 5678" value={form.emergency_contact_phone} onChange={(e) => set("emergency_contact_phone", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emergency_contact_relationship">Relationship</Label>
                      <Input id="emergency_contact_relationship" placeholder="e.g. Parent, Spouse" value={form.emergency_contact_relationship} onChange={(e) => set("emergency_contact_relationship", e.target.value)} />
                    </div>
                  </div>

                  <div style={{ paddingTop: "0.75rem", borderTop: "1px solid var(--surface-4)" }}>
                    <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "12px" }}>
                      Health Insurance
                    </p>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="health_insurance_provider">Provider</Label>
                          <Input id="health_insurance_provider" placeholder="e.g. Discovery Health" value={form.health_insurance_provider} onChange={(e) => set("health_insurance_provider", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="health_insurance_policy_number">Policy Number</Label>
                          <Input id="health_insurance_policy_number" placeholder="e.g. 123456789" value={form.health_insurance_policy_number} onChange={(e) => set("health_insurance_policy_number", e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="health_insurance_expiry_date">Expiry Date</Label>
                        <Input id="health_insurance_expiry_date" type="date" value={form.health_insurance_expiry_date} onChange={(e) => set("health_insurance_expiry_date", e.target.value)} />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {error && (
                <p style={{ fontSize: "12px", color: "hsl(0 70% 65%)", padding: "10px 12px", background: "hsl(0 70% 52% / 0.08)", borderRadius: "8px", border: "1px solid hsl(0 70% 52% / 0.2)" }}>
                  {error}
                </p>
              )}
            </div>

            {/* Card footer / nav */}
            <div
              className="flex justify-between items-center"
              style={{ padding: "1rem 2rem", borderTop: "1px solid hsl(22 8% 12%)" }}
            >
              <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 1}>
                Back
              </Button>

              {step < TOTAL_STEPS ? (
                <Button
                  disabled={saving}
                  onClick={async () => {
                    setError(null);
                    if (step === 1 && !passwordSet) {
                      if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
                      if (password !== confirmPassword) { setError("Passwords do not match."); return; }
                      setSaving(true);
                      const { error: pwError } = await supabase.auth.updateUser({ password });
                      setSaving(false);
                      if (pwError) { setError(pwError.message); return; }
                      setPasswordSet(true);
                      setStep((s) => s + 1);
                      return;
                    }
                    if (step === 2 && !form.first_name.trim()) { setError("First name is required."); return; }
                    if (step === 2 && !form.last_name.trim()) { setError("Last name is required."); return; }
                    setStep((s) => s + 1);
                  }}
                >
                  {step === 1 && !passwordSet ? (saving ? "Setting…" : "Set Password & Continue") : "Continue"}
                </Button>
              ) : (
                <Button onClick={handleFinish} disabled={saving}>
                  {saving ? "Saving…" : "Complete Setup"}
                </Button>
              )}
            </div>
          </div>

          {/* Slogan footer */}
          <p style={{ textAlign: "center", marginTop: "2rem", fontSize: "9px", letterSpacing: "0.25em", color: "var(--text-tertiary)", textTransform: "uppercase" }}>
            Catalyse a Generation · Evangelise the World
          </p>
        </div>
      </div>
    </div>
  );
}
