// Shared bits for the visa route handlers. The database functions (363)
// decide who may do what; these only turn their errors into HTTP answers
// and stop writes on preview deployments, which share the live database.

import { NextResponse } from "next/server";
import { previewWriteRefusal } from "@/lib/preview-writes";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}

/** Calendar date "YYYY-MM-DD" that really exists. */
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** 403 on a preview deployment; null when writes are allowed. */
export function refusePreviewWrite(): NextResponse | null {
  const r = previewWriteRefusal();
  return r ? NextResponse.json(r.body, { status: r.status }) : null;
}

interface DbError {
  code?: string;
  message?: string;
}

/**
 * The workflow functions raise 42501 (not allowed), P0002 (not found) or
 * P0001 (a rule, with a message written for people). Anything else is a
 * server error whose text we don't pass on.
 */
export function rpcErrorResponse(error: DbError): NextResponse {
  switch (error.code) {
    case "42501":
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    case "P0002":
      return NextResponse.json({ error: error.message ?? "Not found" }, { status: 404 });
    case "P0001":
      return NextResponse.json({ error: error.message ?? "Not allowed right now" }, { status: 409 });
    default:
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

/** Optional note: trimmed, capped, empty → null. */
export function cleanNote(v: unknown, max = 2000): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t ? t : null;
}

export const UPLOAD_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
export const VISA_BUCKET = "visa-documents";
/** Signed download links last this long (seconds). */
export const SIGNED_URL_TTL = 300;
