// Editorial template starters. Each template is a CampaignBody preset that
// users can apply on campaign creation (or via "Apply template" inside the
// composer). Templates exercise the editorial block vocabulary so
// non-designer users land on a professionally-structured starting point
// rather than a blank page.

import type { CampaignBody, CampaignBlock } from "@/lib/campaigns/blocks";

export type CampaignTemplate = {
  id: string;
  name: string;
  tagline: string;
  vibe: "story" | "update" | "announce" | "appeal" | "recap" | "invite";
  build(makeId: () => string): CampaignBody;
};

// Type-narrowed block builder: `b(id, "heading", { text, eyebrow })`.
function b<T extends CampaignBlock["type"]>(
  makeId: () => string,
  type: T,
  fields: Omit<Extract<CampaignBlock, { type: T }>, "id" | "type">
): Extract<CampaignBlock, { type: T }> {
  return { id: makeId(), type, ...fields } as Extract<CampaignBlock, { type: T }>;
}

// ────────────────────────────────────────────────────────────
// 1. Long Read — editorial article
// ────────────────────────────────────────────────────────────

const LONG_READ: CampaignTemplate = {
  id: "long-read",
  name: "The Long Read",
  tagline: "A magazine-style story — eyebrow, headline, drop cap, pull quote, photo.",
  vibe: "story",
  build: (id) => ({
    version: 1,
    blocks: [
      b(id, "eyebrow", { text: "STORY" }),
      b(id, "heading", { text: "A headline that earns the click" }),
      b(id, "text", {
        dropCap: true,
        text:
          "Open with a sentence that drops the reader into the moment — a smell, a voice, a glance across the room. Editorial writing earns attention by being specific, not general. Two short paragraphs is plenty before the first image or quote.",
      }),
      b(id, "image", {
        url: "",
        alt: "",
        caption: "A line of context for the photograph.",
      }),
      b(id, "text", {
        text:
          "Continue the story. Use short paragraphs. Pivot when needed. The reader is on a phone — every line earns the next.",
      }),
      b(id, "quote", {
        text: "A single sentence worth pulling out of the body copy.",
        attribution: "Source or role",
      }),
      b(id, "text", {
        text:
          "Bring it home. What did this mean? Why now? What happens next? End with movement, not a conclusion.",
      }),
      b(id, "divider", { style: "rule" }),
      b(id, "button", {
        text: "Read the full story",
        url: "https://",
        style: "link",
      }),
    ],
  }),
};

// ────────────────────────────────────────────────────────────
// 2. The Update — numbered sections of news
// ────────────────────────────────────────────────────────────

const UPDATE: CampaignTemplate = {
  id: "update",
  name: "The Update",
  tagline: "Numbered sections — perfect for monthly news or program briefings.",
  vibe: "update",
  build: (id) => ({
    version: 1,
    blocks: [
      b(id, "eyebrow", { text: "MONTHLY UPDATE" }),
      b(id, "heading", { text: "Here's what's moving" }),
      b(id, "text", {
        text:
          "Lead with one sentence that frames the month. Save the detail for the numbered sections below.",
      }),
      b(id, "divider", { style: "dots" }),
      b(id, "heading", { eyebrow: "01", text: "First update" }),
      b(id, "text", {
        text: "A short paragraph on what happened and why it matters.",
      }),
      b(id, "spacer", { size: "md" }),
      b(id, "heading", { eyebrow: "02", text: "Second update" }),
      b(id, "text", {
        text: "Same shape. Keep each section tight — two or three sentences.",
      }),
      b(id, "spacer", { size: "md" }),
      b(id, "heading", { eyebrow: "03", text: "Third update" }),
      b(id, "text", {
        text: "If a section warrants more, link out to the longer piece.",
      }),
      b(id, "divider", { style: "rule" }),
      b(id, "button", {
        text: "Read every update",
        url: "https://",
        style: "outline",
      }),
    ],
  }),
};

// ────────────────────────────────────────────────────────────
// 3. The Announcement — bold, sparse, big news
// ────────────────────────────────────────────────────────────

const ANNOUNCEMENT: CampaignTemplate = {
  id: "announcement",
  name: "The Announcement",
  tagline: "Sparse, confident, headline-led — for launches and big news.",
  vibe: "announce",
  build: (id) => ({
    version: 1,
    blocks: [
      b(id, "spacer", { size: "lg" }),
      b(id, "eyebrow", { text: "ANNOUNCING" }),
      b(id, "heading", { text: "The thing we've been waiting to share" }),
      b(id, "spacer", { size: "sm" }),
      b(id, "text", {
        text:
          "One paragraph is enough. Say what it is, why it matters, and what to do next. Then stop.",
      }),
      b(id, "spacer", { size: "md" }),
      b(id, "button", {
        text: "Learn more",
        url: "https://",
        style: "filled",
      }),
      b(id, "spacer", { size: "lg" }),
      b(id, "image", { url: "", alt: "", fullBleed: true }),
    ],
  }),
};

// ────────────────────────────────────────────────────────────
// 4. The Appeal — fundraising / urgent ask
// ────────────────────────────────────────────────────────────

const APPEAL: CampaignTemplate = {
  id: "appeal",
  name: "The Appeal",
  tagline: "Story → testimony → CTA card. Designed for fundraising asks.",
  vibe: "appeal",
  build: (id) => ({
    version: 1,
    blocks: [
      b(id, "image", {
        url: "",
        alt: "",
        caption: "A single image carries the weight of the ask.",
        fullBleed: true,
      }),
      b(id, "eyebrow", { text: "AN URGENT NEED" }),
      b(id, "heading", { text: "Why we're writing today" }),
      b(id, "text", {
        dropCap: true,
        text:
          "Tell one specific story. Not the statistics — the person. The moment you realized this work was needed. The face you can't stop thinking about.",
      }),
      b(id, "quote", {
        text: "A line in someone else's voice — student, team member, partner.",
        attribution: "Name, role",
      }),
      b(id, "text", {
        text:
          "Connect the story to the action. Make the ask specific: an amount, a deadline, a number of people who could be reached.",
      }),
      b(id, "cta", {
        heading: "Give today",
        text: "Even a small monthly gift compounds across a year of work.",
        buttonText: "Donate now",
        buttonUrl: "https://",
      }),
      b(id, "text", {
        text:
          "Sign off with warmth. A first name. A thank-you that means it.",
      }),
    ],
  }),
};

// ────────────────────────────────────────────────────────────
// 5. The Recap — events, photos, reflection
// ────────────────────────────────────────────────────────────

const RECAP: CampaignTemplate = {
  id: "recap",
  name: "The Recap",
  tagline: "Photos + reflection — for after events, trainings, and outreach.",
  vibe: "recap",
  build: (id) => ({
    version: 1,
    blocks: [
      b(id, "eyebrow", { text: "EVENT RECAP" }),
      b(id, "heading", { text: "What happened — and what's next" }),
      b(id, "text", {
        text:
          "Two sentences setting the scene. Where, when, who. Then let the photos do the talking.",
      }),
      b(id, "image", {
        url: "",
        alt: "",
        fullBleed: true,
        caption: "Opening session.",
      }),
      b(id, "text", {
        text:
          "A paragraph on what surprised you. The thing you didn't see coming. The moment everyone in the room felt the same thing at the same time.",
      }),
      b(id, "image-text", {
        url: "",
        alt: "",
        heading: "Highlight one",
        text:
          "A few sentences about a specific moment, person, or breakthrough from the event.",
        layout: "image-left",
      }),
      b(id, "image-text", {
        url: "",
        alt: "",
        heading: "Highlight two",
        text:
          "Another moment worth singling out. The asymmetric layout keeps the page lively.",
        layout: "image-right",
      }),
      b(id, "divider", { style: "rule" }),
      b(id, "heading", { text: "What's next" }),
      b(id, "text", {
        text:
          "Point forward. The next gathering. The next opportunity to be part of this.",
      }),
      b(id, "button", {
        text: "See upcoming events",
        url: "https://",
        style: "outline",
      }),
    ],
  }),
};

// ────────────────────────────────────────────────────────────
// 6. The Invitation — RSVP-ready
// ────────────────────────────────────────────────────────────

const INVITATION: CampaignTemplate = {
  id: "invitation",
  name: "The Invitation",
  tagline: "Date, time, place — paired with a CTA card for RSVP.",
  vibe: "invite",
  build: (id) => ({
    version: 1,
    blocks: [
      b(id, "eyebrow", { text: "YOU'RE INVITED" }),
      b(id, "heading", { text: "An event you'll want to be at" }),
      b(id, "text", {
        text:
          "One short paragraph that says why this matters and who it's for. Save the logistics for the card below.",
      }),
      b(id, "image", { url: "", alt: "", fullBleed: true }),
      b(id, "spacer", { size: "sm" }),
      b(id, "cta", {
        heading: "Saturday, 14 February · 9am",
        text: "Cape Town · doors open at 8:30. Light breakfast provided.",
        buttonText: "RSVP",
        buttonUrl: "https://",
      }),
      b(id, "divider", { style: "rule" }),
      b(id, "heading", { text: "What to expect" }),
      b(id, "text", {
        text:
          "A few sentences on the format — sessions, speakers, the rhythm of the day. Set expectations so people show up ready.",
      }),
      b(id, "button", {
        text: "See the full schedule",
        url: "https://",
        style: "link",
      }),
    ],
  }),
};

// ────────────────────────────────────────────────────────────
// Registry
// ────────────────────────────────────────────────────────────

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  LONG_READ,
  UPDATE,
  ANNOUNCEMENT,
  APPEAL,
  RECAP,
  INVITATION,
];

export function getCampaignTemplate(id: string): CampaignTemplate | undefined {
  return CAMPAIGN_TEMPLATES.find((t) => t.id === id);
}
