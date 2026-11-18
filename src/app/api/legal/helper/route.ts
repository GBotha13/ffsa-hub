/**
 * POST /api/legal/helper — the legal helper chat in Legal → Documents.
 *
 * Body: { messages: [{ role: "user" | "assistant", content: string }] }
 *   (the last one is the new question). Returns { answer, drafts }.
 *
 * Only for people on legal_access. Runs a Claude tool loop AS the
 * signed-in person: every tool goes through their Supabase client, so RLS
 * decides what the helper can read, and the only thing it can write is a
 * draft (src/lib/legal/helper/tools.ts). Approving is not a tool: the
 * owner does that in the Drafts tab, and migration 374 enforces it.
 *
 * Privacy: the conversation is NOT stored. Unlike the Hub assistant this
 * does not write to ai_assistant_queries, which admins can read; only
 * token counts go to the server log.
 */

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { legalGate } from "@/lib/legal/api";
import { todayInSA } from "@/lib/legal/status";
import { LEGAL_HELPER_TOOLS, executeLegalTool } from "@/lib/legal/helper/tools";
import { legalHelperPrompt } from "@/lib/legal/helper/prompt";

export const maxDuration = 300;

const MODEL = "claude-opus-5-5";
const MAX_TURNS = 10;
const BUDGET_MS = 270_000;
const TOOL_RESULT_CAP = 40_000;
const MAX_HISTORY = 20;
const MAX_MESSAGE_CHARS = 8_000;

let anthropic: Anthropic | null = null;
function claude(): Anthropic {
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic;
}

type ChatMessage = { role: "user" | "assistant"; content: string };

function parseMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const msgs: ChatMessage[] = [];
  for (const m of raw.slice(-MAX_HISTORY)) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) return null;
    if (typeof m.content !== "string" || !m.content.trim()) return null;
    msgs.push({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) });
  }
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return null;
  return msgs;
}

export async function POST(request: Request) {
  const t0 = Date.now();
  const gate = await legalGate();
  if (gate.error) return gate.error;
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "The legal helper isn't set up (ANTHROPIC_API_KEY is missing)." }, { status: 503 });
  }
  const { supabase, userId } = gate;

  const body = await request.json().catch(() => null);
  const messages = parseMessages(body?.messages);
  if (!messages) return NextResponse.json({ error: "Invalid messages" }, { status: 400 });

  const [{ data: profile }, { data: isOwner }] = await Promise.all([
    supabase.from("users").select("first_name, last_name").eq("id", userId).maybeSingle(),
    supabase.rpc("legal_is_owner"),
  ]);
  const userName = profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || null : null;

  // Tools + instructions are stable for the day: cache them.
  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: legalHelperPrompt({ today: todayInSA(), userName, isOwner: isOwner === true }),
      cache_control: { type: "ephemeral" },
    },
  ];
  const convo: Anthropic.MessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));
  const drafts = new Map<string, string>();
  let inputTokens = 0;
  let outputTokens = 0;

  const reply = (answer: string, status = 200) => {
    console.info(`[legal-helper] user=${userId} in=${inputTokens} out=${outputTokens} ms=${Date.now() - t0}`);
    return NextResponse.json(
      status === 200
        ? { answer, drafts: [...drafts].map(([id, title]) => ({ id, title })) }
        : { error: answer, drafts: [...drafts].map(([id, title]) => ({ id, title })) },
      { status }
    );
  };

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      if (Date.now() - t0 > BUDGET_MS) {
        return reply("That took longer than expected. Anything saved is in the Drafts tab; ask me to carry on from there.");
      }
      const res = await claude().messages.create({
        model: MODEL,
        max_tokens: 16000,
        output_config: { effort: "medium" },
        system,
        tools: LEGAL_HELPER_TOOLS,
        messages: convo,
      });
      inputTokens +=
        (res.usage?.input_tokens ?? 0) + (res.usage?.cache_creation_input_tokens ?? 0) + (res.usage?.cache_read_input_tokens ?? 0);
      outputTokens += res.usage?.output_tokens ?? 0;

      if (res.stop_reason === "refusal") {
        return reply("The helper declined that request. Try asking another way, or do this one by hand.");
      }

      const toolUses = res.content.filter((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
      if (toolUses.length === 0 || res.stop_reason !== "tool_use") {
        const answer = res.content
          .filter((c): c is Anthropic.TextBlock => c.type === "text")
          .map((c) => c.text)
          .join("\n")
          .trim();
        if (res.stop_reason === "max_tokens" && !answer) {
          return reply("That answer ran too long. Ask for one document at a time.");
        }
        return reply(answer || "I couldn't find an answer to that.");
      }

      // Append the whole turn unchanged (thinking blocks included).
      convo.push({ role: "assistant", content: res.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const u of toolUses) {
        try {
          const outcome = await executeLegalTool(u.name, (u.input ?? {}) as Record<string, unknown>, supabase, userId);
          if (outcome.draft) drafts.set(outcome.draft.id, outcome.draft.title);
          const isError = !!(outcome.output && typeof outcome.output === "object" && "error" in outcome.output);
          results.push({
            type: "tool_result",
            tool_use_id: u.id,
            content: JSON.stringify(outcome.output).slice(0, TOOL_RESULT_CAP),
            ...(isError ? { is_error: true } : {}),
          });
        } catch (e) {
          console.error("[legal-helper] tool failed", u.name, e);
          results.push({ type: "tool_result", tool_use_id: u.id, content: "The lookup failed. Try again.", is_error: true });
        }
      }
      convo.push({ role: "user", content: results });
    }
    return reply("I couldn't finish that in one go. Anything saved is in the Drafts tab; ask me to carry on.");
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return reply("The helper is busy right now. Try again in a minute.", 429);
    if (e instanceof Anthropic.APIError) {
      console.error("[legal-helper] API error", e.status, e.message);
      return reply("The helper is unavailable right now. Try again later.", 502);
    }
    console.error("[legal-helper] run failed", e);
    return reply("Something went wrong. Try again.", 500);
  }
}
