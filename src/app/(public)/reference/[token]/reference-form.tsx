"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2 } from "lucide-react";
import Image from "next/image";

const CHARACTER_TRAITS = [
  "Teachability",
  "Accountability",
  "Adaptability/Flexibility",
  "Concern for others",
  "Initiative",
  "Servanthood",
  "Self-discipline",
  "Personal Devotions",
  "Desire for Growth",
  "Emotional Stability",
  "Self-Image",
  "Response to Pressure",
  "Reliability & Faithfulness",
  "Financial Responsibility",
  "Vulnerability",
  "Integrity",
  "Purity",
  "Personal Appearance",
  "Physical Health",
  "Mental Health",
  "Organizational Abilities",
] as const;

const RATING_OPTIONS = ["Excellent", "Good", "Fair", "Poor"] as const;

const CHRISTIAN_HISTORY_OPTIONS = [
  "Mature",
  "Contagious",
  "Genuine and Growing",
  "Over-emotional",
  "Superficial",
] as const;

const RECOMMENDATION_OPTIONS = [
  "Yes",
  "Yes, with reservations",
  "No",
] as const;

export function ReferenceForm({
  token,
  refereeName,
  applicantName,
  programName,
  slotLabel,
  slotDescription,
}: {
  token: string;
  refereeName: string;
  applicantName: string;
  programName: string;
  slotLabel: string;
  slotDescription: string | null;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Basic info
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [relationship, setRelationship] = useState("");
  const [knownDuration, setKnownDuration] = useState("");
  const [growthContext, setGrowthContext] = useState("");

  // Character ratings
  const [ratings, setRatings] = useState<Record<string, string>>({});

  // Short answers
  const [additionalComments, setAdditionalComments] = useState("");
  const [christianHistory, setChristianHistory] = useState("");
  const [christianHistoryWhy, setChristianHistoryWhy] = useState("");
  const [strengthsWeaknesses, setStrengthsWeaknesses] = useState("");
  const [seekingGrowth, setSeekingGrowth] = useState("");
  const [missionsMinistry, setMissionsMinistry] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [recommendationExplanation, setRecommendationExplanation] = useState("");
  const [otherComments, setOtherComments] = useState("");

  function setRating(trait: string, value: string) {
    setRatings((prev) => ({ ...prev, [trait]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!relationship.trim()) {
      setError("Please describe your relationship to the applicant.");
      return;
    }
    if (!knownDuration.trim()) {
      setError("Please indicate how long you have known the applicant.");
      return;
    }
    if (!growthContext.trim()) {
      setError("Please describe the context of your involvement in the applicant's growth.");
      return;
    }

    const missingRatings = CHARACTER_TRAITS.filter((t) => !ratings[t]);
    if (missingRatings.length > 0) {
      setError(`Please rate all character traits. Missing: ${missingRatings[0]}`);
      return;
    }

    if (!christianHistory) {
      setError("Please select what best describes the applicant's Christian history.");
      return;
    }
    if (!christianHistoryWhy.trim()) {
      setError("Please explain why you chose that Christian history description.");
      return;
    }
    if (!strengthsWeaknesses.trim()) {
      setError("Please describe the applicant's strengths and weaknesses.");
      return;
    }
    if (!seekingGrowth.trim()) {
      setError("Please answer whether the applicant is actively seeking growth.");
      return;
    }
    if (!missionsMinistry.trim()) {
      setError("Please describe in what area of missions/ministry the applicant thrives.");
      return;
    }
    if (!recommendation) {
      setError("Please indicate whether you would recommend this applicant.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/public/references", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          relationship,
          known_duration: knownDuration,
          reference_text: strengthsWeaknesses,
          form_data: {
            whatsapp_number: whatsappNumber,
            growth_context: growthContext,
            character_ratings: ratings,
            additional_comments: additionalComments,
            christian_history: christianHistory,
            christian_history_why: christianHistoryWhy,
            strengths_weaknesses: strengthsWeaknesses,
            seeking_growth: seekingGrowth,
            missions_ministry: missionsMinistry,
            recommendation,
            recommendation_explanation: recommendationExplanation,
            other_comments: otherComments,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to submit reference. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#0D0B09" }}>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md space-y-4">
            <CheckCircle2 className="mx-auto h-12 w-12" style={{ color: "hsl(142 55% 58%)" }} />
            <h1 style={{ fontFamily: "var(--font-bebas,'Arial Black',sans-serif)", fontSize: "2rem", color: "#F0EBE3", letterSpacing: "0.04em" }}>
              Thank You!
            </h1>
            <p className="text-sm" style={{ color: "#B8A898" }}>
              Your reference for {applicantName} has been submitted successfully. The admissions team will review it along with the application.
            </p>
          </div>
        </div>
        <p style={{ textAlign: "center", padding: "2rem", fontSize: "9px", letterSpacing: "0.25em", color: "hsl(30 8% 22%)", textTransform: "uppercase" }}>
          Catalyse a Generation · Evangelise the World
        </p>
      </div>
    );
  }

  const inputStyle = {
    background: "hsl(22 10% 10%)",
    border: "1px solid hsl(22 8% 18%)",
    color: "#F0EBE3",
  };

  const labelStyle = { color: "#F0EBE3", fontSize: "13px", fontWeight: 500 } as const;
  const subLabelStyle = { color: "hsl(30 8% 50%)", fontSize: "11px" } as const;
  const sectionHeadingStyle = {
    fontFamily: "var(--font-bebas,'Arial Black',sans-serif)",
    fontSize: "1.25rem",
    letterSpacing: "0.04em",
    color: "#F0EBE3",
    lineHeight: 1,
  } as const;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0D0B09" }}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-8 py-5"
        style={{ borderBottom: "1px solid hsl(22 8% 12%)" }}
      >
        <div className="flex items-center gap-3">
          <Image src="/ff-logo.png" alt="Fire & Fragrance" width={80} height={20} style={{ objectFit: "contain" }} priority />
          <div style={{ height: "1px", width: "12px", background: "var(--yellow)" }} />
          <span style={{ fontSize: "8px", letterSpacing: "0.3em", fontWeight: 700, color: "var(--yellow)", textTransform: "uppercase" }}>
            HUB
          </span>
        </div>
        <p style={{ fontSize: "10px", letterSpacing: "0.2em", color: "hsl(30 8% 42%)", textTransform: "uppercase" }}>
          Reference Form
        </p>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <div
            style={{
              background: "hsl(22 10% 8%)",
              border: "1px solid hsl(22 8% 14%)",
              borderRadius: "16px",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{ padding: "1.75rem 2rem 1.25rem", borderBottom: "1px solid hsl(22 8% 12%)" }}>
              <p style={{ fontSize: "11px", letterSpacing: "0.2em", fontWeight: 700, color: "hsl(42 95% 55%)", textTransform: "uppercase", marginBottom: "6px" }}>
                {slotLabel}
              </p>
              <h2 style={{ fontFamily: "var(--font-bebas,'Arial Black',sans-serif)", fontSize: "1.75rem", letterSpacing: "0.04em", color: "#F0EBE3", lineHeight: 1 }}>
                Reference for {applicantName}
              </h2>
              <p style={{ fontSize: "12px", color: "hsl(30 8% 55%)", marginTop: "6px" }}>
                Application to <strong style={{ color: "#F0EBE3" }}>{programName}</strong>
              </p>
              <p style={{ fontSize: "12px", color: "hsl(30 8% 45%)", marginTop: "12px", lineHeight: 1.5 }}>
                Thank you for agreeing to fill out this reference form. Please fill out the form truthfully and with discretion as we will be praying intentionally through each student.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              {/* ─── SECTION 1: Basic Info ─── */}
              <div style={{ padding: "1.5rem 2rem", borderBottom: "1px solid hsl(22 8% 12%)" }} className="space-y-4">
                <div className="space-y-1.5">
                  <Label style={labelStyle}>What is your WhatsApp number in case we need to contact you for follow up?</Label>
                  <Input
                    placeholder="+27 ..."
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label style={labelStyle}>
                    What is your relationship to the applicant? <span style={{ color: "hsl(0 70% 65%)" }}>*</span>
                  </Label>
                  <Input
                    placeholder="e.g. Friend, fellow church member, colleague..."
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label style={labelStyle}>
                    How long have you known the applicant? <span style={{ color: "hsl(0 70% 65%)" }}>*</span>
                  </Label>
                  <Input
                    placeholder="e.g. 3 years"
                    value={knownDuration}
                    onChange={(e) => setKnownDuration(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label style={labelStyle}>
                    In what context have you been a part of the applicant's growth and discipleship process? <span style={{ color: "hsl(0 70% 65%)" }}>*</span>
                  </Label>
                  <p style={subLabelStyle}>
                    i.e. observing them in class while in DTS, walking alongside them as a one-on-one on outreach, in small group contexts within church, etc.
                  </p>
                  <Textarea
                    value={growthContext}
                    onChange={(e) => setGrowthContext(e.target.value)}
                    rows={3}
                    style={inputStyle}
                    required
                  />
                </div>
              </div>

              {/* ─── SECTION 2: Character Ratings ─── */}
              <div style={{ padding: "1.5rem 2rem", borderBottom: "1px solid hsl(22 8% 12%)" }} className="space-y-5">
                <div>
                  <h3 style={sectionHeadingStyle}>Character Assessment</h3>
                  <p style={{ ...subLabelStyle, marginTop: "4px" }}>
                    Please describe the applicant's character based on the choices below.
                  </p>
                </div>

                <div className="space-y-4">
                  {CHARACTER_TRAITS.map((trait) => (
                    <div key={trait}>
                      <p style={{ ...labelStyle, marginBottom: "6px" }}>
                        {trait} <span style={{ color: "hsl(0 70% 65%)" }}>*</span>
                      </p>
                      <div className="flex flex-wrap gap-x-5 gap-y-1">
                        {RATING_OPTIONS.map((option) => (
                          <label key={option} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`rating-${trait}`}
                              value={option}
                              checked={ratings[trait] === option}
                              onChange={() => setRating(trait, option)}
                              className="accent-[hsl(42,95%,55%)]"
                            />
                            <span style={{ fontSize: "12px", color: "hsl(30 8% 65%)" }}>{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <Label style={labelStyle}>Do you have any additional comments?</Label>
                  <Textarea
                    value={additionalComments}
                    onChange={(e) => setAdditionalComments(e.target.value)}
                    rows={3}
                    style={inputStyle}
                    placeholder="Optional"
                  />
                </div>
              </div>

              {/* ─── SECTION 3: Short Answers ─── */}
              <div style={{ padding: "1.5rem 2rem" }} className="space-y-5">
                <div>
                  <h3 style={sectionHeadingStyle}>Short Answer Section</h3>
                  <p style={{ ...subLabelStyle, marginTop: "4px" }}>
                    Please fill out the following to the best of your knowledge.
                  </p>
                </div>

                {/* Christian History */}
                <div className="space-y-2">
                  <p style={labelStyle}>
                    What would best describe the applicant's Christian history? <span style={{ color: "hsl(0 70% 65%)" }}>*</span>
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {CHRISTIAN_HISTORY_OPTIONS.map((option) => (
                      <label key={option} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="christian-history"
                          value={option}
                          checked={christianHistory === option}
                          onChange={() => setChristianHistory(option)}
                          className="accent-[hsl(42,95%,55%)]"
                        />
                        <span style={{ fontSize: "12px", color: "hsl(30 8% 65%)" }}>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label style={labelStyle}>
                    Tell us why you chose the answer above <span style={{ color: "hsl(0 70% 65%)" }}>*</span>
                  </Label>
                  <Input
                    value={christianHistoryWhy}
                    onChange={(e) => setChristianHistoryWhy(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label style={labelStyle}>
                    What are a few of the applicant's strengths and weaknesses? <span style={{ color: "hsl(0 70% 65%)" }}>*</span>
                  </Label>
                  <Textarea
                    value={strengthsWeaknesses}
                    onChange={(e) => setStrengthsWeaknesses(e.target.value)}
                    rows={4}
                    style={inputStyle}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label style={labelStyle}>
                    Do you see them actively seeking growth in their life? If yes, give an example. If no, please explain why not. <span style={{ color: "hsl(0 70% 65%)" }}>*</span>
                  </Label>
                  <Textarea
                    value={seekingGrowth}
                    onChange={(e) => setSeekingGrowth(e.target.value)}
                    rows={4}
                    style={inputStyle}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label style={labelStyle}>
                    In what area of missions/ministry have you seen the applicant thrive or come alive? <span style={{ color: "hsl(0 70% 65%)" }}>*</span>
                  </Label>
                  <Textarea
                    value={missionsMinistry}
                    onChange={(e) => setMissionsMinistry(e.target.value)}
                    rows={4}
                    style={inputStyle}
                    required
                  />
                </div>

                {/* Recommendation */}
                <div className="space-y-2">
                  <p style={labelStyle}>
                    Would you recommend them for this Bible school? <span style={{ color: "hsl(0 70% 65%)" }}>*</span>
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {RECOMMENDATION_OPTIONS.map((option) => (
                      <label key={option} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="recommendation"
                          value={option}
                          checked={recommendation === option}
                          onChange={() => setRecommendation(option)}
                          className="accent-[hsl(42,95%,55%)]"
                        />
                        <span style={{ fontSize: "12px", color: "hsl(30 8% 65%)" }}>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label style={labelStyle}>
                    Please explain your reservations or why you would not recommend them.
                  </Label>
                  <Textarea
                    value={recommendationExplanation}
                    onChange={(e) => setRecommendationExplanation(e.target.value)}
                    rows={3}
                    style={inputStyle}
                    placeholder="Optional — required if you selected 'Yes, with reservations' or 'No'"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label style={labelStyle}>Do you have any other comments?</Label>
                  <Input
                    value={otherComments}
                    onChange={(e) => setOtherComments(e.target.value)}
                    style={inputStyle}
                    placeholder="Optional"
                  />
                </div>

                {error && (
                  <p style={{ fontSize: "12px", color: "hsl(0 70% 65%)", padding: "10px 12px", background: "hsl(0 70% 52% / 0.08)", borderRadius: "8px", border: "1px solid hsl(0 70% 52% / 0.2)" }}>
                    {error}
                  </p>
                )}
              </div>

              {/* Submit */}
              <div
                className="flex justify-end"
                style={{ padding: "1rem 2rem", borderTop: "1px solid hsl(22 8% 12%)" }}
              >
                <Button type="submit" disabled={loading}>
                  {loading ? "Submitting..." : "Submit Reference"}
                </Button>
              </div>
            </form>
          </div>

          <p style={{ textAlign: "center", marginTop: "2rem", fontSize: "9px", letterSpacing: "0.25em", color: "hsl(30 8% 22%)", textTransform: "uppercase" }}>
            Catalyse a Generation · Evangelise the World
          </p>
        </div>
      </div>
    </div>
  );
}
