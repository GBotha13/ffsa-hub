"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateUserProfile, completeOnboarding } from "@/services/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const TOTAL_STEPS = 5;

const STEP_LABELS = [
  "Set Password",
  "Personal Info",
  "Address",
  "Passport & Visa",
  "Emergency & Health",
];

interface FormData {
  // Step 1 — Personal Info
  first_name: string;
  last_name: string;
  preferred_name: string;
  date_of_birth: string;
  gender: string;
  marital_status: string;
  nationality: string;
  phone: string;
  // Step 2 — Address
  address_line_1: string;
  address_line_2: string;
  city: string;
  province: string;
  country: string;
  postal_code: string;
  // Step 3 — Passport & Visa
  is_international: boolean;
  passport_country: string;
  passport_number: string;
  visa_category: string; // "" | "90_day" | "long_term"
  visa_type: string;
  visa_expiry_date: string;
  // Step 4 — Emergency & Health
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  health_insurance_provider: string;
  health_insurance_policy_number: string;
  health_insurance_expiry_date: string;
}

const EMPTY_FORM: FormData = {
  first_name: "",
  last_name: "",
  preferred_name: "",
  date_of_birth: "",
  gender: "",
  marital_status: "",
  nationality: "",
  phone: "",
  address_line_1: "",
  address_line_2: "",
  city: "",
  province: "",
  country: "",
  postal_code: "",
  is_international: false,
  passport_country: "",
  passport_number: "",
  visa_category: "",
  visa_type: "",
  visa_expiry_date: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  emergency_contact_relationship: "",
  health_insurance_provider: "",
  health_insurance_policy_number: "",
  health_insurance_expiry_date: "",
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
      if (!authUser) {
        router.push("/login");
        return;
      }

      setUserId(authUser.id);

      // Load app user (personal details are on the user record directly)
      const { data: appUser } = await (supabase as any)
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (!appUser) {
        router.push("/login");
        return;
      }

      // If already onboarded, skip wizard
      if (appUser.accepted_at) {
        const { data: roles } = await (supabase as any)
          .from("user_roles")
          .select("roles(name)")
          .eq("user_id", authUser.id);

        const adminRoles = ["super_admin", "admin", "events_admin", "program_leader", "team_leader", "staff", "finance_admin", "comms_admin", "mission_leader"];
        const roleNames = (roles ?? []).flatMap((r: any) =>
          Array.isArray(r.roles) ? r.roles.map((x: any) => x.name) : r.roles ? [r.roles.name] : []
        );
        router.push(roleNames.some((r: string) => adminRoles.includes(r)) ? "/dashboard" : "/profile");
        return;
      }

      // Pre-fill from existing user record
      setForm({
        first_name: appUser.first_name ?? "",
        last_name: appUser.last_name ?? "",
        preferred_name: appUser.preferred_name ?? "",
        date_of_birth: appUser.date_of_birth ?? "",
        gender: appUser.gender ?? "",
        marital_status: appUser.marital_status ?? "",
        nationality: appUser.nationality ?? "",
        phone: appUser.phone ?? "",
        address_line_1: appUser.address_line_1 ?? "",
        address_line_2: appUser.address_line_2 ?? "",
        city: appUser.city ?? "",
        province: appUser.province ?? "",
        country: appUser.country ?? "",
        postal_code: appUser.postal_code ?? "",
        is_international: appUser.is_international ?? false,
        passport_country: appUser.passport_country ?? "",
        passport_number: appUser.passport_number ?? "",
        visa_category: appUser.visa_category ?? "",
        visa_type: appUser.visa_type ?? "",
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

  function nullify(val: string) {
    return val.trim() === "" ? null : val.trim();
  }

  async function handleFinish() {
    if (!userId) return;
    setSaving(true);
    setError(null);

    try {
      const { error: profileError } = await updateUserProfile(supabase, userId, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        preferred_name: nullify(form.preferred_name),
        date_of_birth: nullify(form.date_of_birth),
        gender: nullify(form.gender),
        marital_status: nullify(form.marital_status),
        nationality: nullify(form.nationality),
        phone: nullify(form.phone),
        address_line_1: nullify(form.address_line_1),
        address_line_2: nullify(form.address_line_2),
        city: nullify(form.city),
        province: nullify(form.province),
        country: nullify(form.country),
        postal_code: nullify(form.postal_code),
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

      // Redirect based on roles
      const { data: roles } = await (supabase as any)
        .from("user_roles")
        .select("roles(name)")
        .eq("user_id", userId);

      const adminRoles = ["super_admin", "admin", "events_admin", "program_leader", "team_leader", "staff", "finance_admin", "comms_admin", "mission_leader"];
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
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      {/* Progress bar */}
      <div className="mb-8 w-full max-w-lg">
        <div className="mb-2 flex justify-between text-xs text-muted-foreground">
          {STEP_LABELS.map((label, i) => (
            <span
              key={label}
              className={i + 1 === step ? "font-semibold text-foreground" : ""}
            >
              {label}
            </span>
          ))}
        </div>
        <div className="h-2 w-full rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-1 text-right text-xs text-muted-foreground">
          Step {step} of {TOTAL_STEPS}
        </p>
      </div>

      <Card className="w-full max-w-lg">
        {/* Step 1 — Set Password */}
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle>Set Your Password</CardTitle>
              <CardDescription>Create a password so you can log in later.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={passwordSet}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm Password *</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={passwordSet}
                />
              </div>
              {passwordSet && (
                <p className="text-sm text-green-600 font-medium">Password set successfully!</p>
              )}
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </CardContent>
          </>
        )}

        {/* Step 2 — Personal Info */}
        {step === 2 && (
          <>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Tell us about yourself. Fields marked * are required.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  <select
                    id="marital_status"
                    value={form.marital_status}
                    onChange={(e) => set("marital_status", e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Select...</option>
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
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" type="tel" placeholder="+27 71 234 5678" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                </div>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 3 — Address */}
        {step === 3 && (
          <>
            <CardHeader>
              <CardTitle>Address</CardTitle>
              <CardDescription>Your current address or on-base address.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </>
        )}

        {/* Step 4 — Passport & Visa */}
        {step === 4 && (
          <>
            <CardHeader>
              <CardTitle>Passport & Visa</CardTitle>
              <CardDescription>Only applicable for international staff. Local South Africans can skip this step.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* International checkbox */}
              <label className="flex items-center gap-3 cursor-pointer rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                <input
                  type="checkbox"
                  checked={form.is_international}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    is_international: e.target.checked,
                    ...(!e.target.checked && { passport_country: "", passport_number: "", visa_category: "", visa_type: "", visa_expiry_date: "" }),
                  }))}
                  className="h-5 w-5 rounded border-gray-300"
                />
                <div>
                  <p className="text-sm font-medium">I am an international visitor or staff member</p>
                  <p className="text-xs text-muted-foreground">Check this if you are not a South African citizen</p>
                </div>
              </label>

              {form.is_international && (
                <>
                  {/* Passport info */}
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

                  {/* Visa category selection */}
                  <div className="space-y-3 pt-2 border-t">
                    <p className="text-sm font-medium">Visa Status</p>
                    <div className="grid grid-cols-2 gap-3">
                      <label className={`flex items-center gap-3 cursor-pointer rounded-lg border p-3 transition-colors ${form.visa_category === "90_day" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                        <input
                          type="radio"
                          name="visa_category"
                          value="90_day"
                          checked={form.visa_category === "90_day"}
                          onChange={() => setForm((prev) => ({ ...prev, visa_category: "90_day", visa_type: "", visa_expiry_date: "" }))}
                          className="h-4 w-4"
                        />
                        <div>
                          <p className="text-sm font-medium">90-Day Visa</p>
                          <p className="text-xs text-muted-foreground">Short-term visitor</p>
                        </div>
                      </label>
                      <label className={`flex items-center gap-3 cursor-pointer rounded-lg border p-3 transition-colors ${form.visa_category === "long_term" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                        <input
                          type="radio"
                          name="visa_category"
                          value="long_term"
                          checked={form.visa_category === "long_term"}
                          onChange={() => setForm((prev) => ({ ...prev, visa_category: "long_term" }))}
                          className="h-4 w-4"
                        />
                        <div>
                          <p className="text-sm font-medium">Long-Term Visa</p>
                          <p className="text-xs text-muted-foreground">Work, study, or religious visa</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Long-term visa details */}
                  {form.visa_category === "long_term" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="visa_type">Visa Type</Label>
                        <Input id="visa_type" placeholder="e.g. Religious, Study, Work" value={form.visa_type} onChange={(e) => set("visa_type", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="visa_expiry_date">Visa Expiry Date</Label>
                        <Input id="visa_expiry_date" type="date" value={form.visa_expiry_date} onChange={(e) => set("visa_expiry_date", e.target.value)} />
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </>
        )}

        {/* Step 5 — Emergency Contact & Health */}
        {step === 5 && (
          <>
            <CardHeader>
              <CardTitle>Emergency Contact & Health</CardTitle>
              <CardDescription>Who should we contact in an emergency? Also your health insurance details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
                <Input id="emergency_contact_name" placeholder="Full name" value={form.emergency_contact_name} onChange={(e) => set("emergency_contact_name", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergency_contact_phone">Emergency Contact Phone</Label>
                  <Input id="emergency_contact_phone" type="tel" placeholder="+27 71 234 5678" value={form.emergency_contact_phone} onChange={(e) => set("emergency_contact_phone", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergency_contact_relationship">Relationship</Label>
                  <Input id="emergency_contact_relationship" placeholder="e.g. Parent, Spouse" value={form.emergency_contact_relationship} onChange={(e) => set("emergency_contact_relationship", e.target.value)} />
                </div>
              </div>

              <div className="pt-2 border-t">
                <p className="text-sm font-medium mb-3">Health Insurance</p>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="health_insurance_provider">Insurance Provider</Label>
                      <Input id="health_insurance_provider" placeholder="e.g. Discovery Health" value={form.health_insurance_provider} onChange={(e) => set("health_insurance_provider", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="health_insurance_policy_number">Policy Number</Label>
                      <Input id="health_insurance_policy_number" placeholder="e.g. 123456789" value={form.health_insurance_policy_number} onChange={(e) => set("health_insurance_policy_number", e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="health_insurance_expiry_date">Insurance Expiry Date</Label>
                    <Input id="health_insurance_expiry_date" type="date" value={form.health_insurance_expiry_date} onChange={(e) => set("health_insurance_expiry_date", e.target.value)} />
                  </div>
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </CardContent>
          </>
        )}

        {/* Navigation */}
        <div className="flex justify-between border-t px-6 py-4">
          <Button
            variant="outline"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 1}
          >
            Back
          </Button>

          {step < TOTAL_STEPS ? (
            <Button
              disabled={saving}
              onClick={async () => {
                setError(null);

                // Step 1: Set password
                if (step === 1 && !passwordSet) {
                  if (password.length < 6) {
                    setError("Password must be at least 6 characters.");
                    return;
                  }
                  if (password !== confirmPassword) {
                    setError("Passwords do not match.");
                    return;
                  }
                  setSaving(true);
                  const { error: pwError } = await supabase.auth.updateUser({ password });
                  setSaving(false);
                  if (pwError) {
                    setError(pwError.message);
                    return;
                  }
                  setPasswordSet(true);
                  setStep((s) => s + 1);
                  return;
                }

                // Step 2: Personal info validation
                if (step === 2 && !form.first_name.trim()) {
                  setError("First name is required.");
                  return;
                }
                if (step === 2 && !form.last_name.trim()) {
                  setError("Last name is required.");
                  return;
                }

                setStep((s) => s + 1);
              }}
            >
              {step === 1 && !passwordSet ? (saving ? "Setting…" : "Set Password & Continue") : "Next"}
            </Button>
          ) : (
            <Button onClick={handleFinish} disabled={saving}>
              {saving ? "Saving…" : "Complete Setup"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
