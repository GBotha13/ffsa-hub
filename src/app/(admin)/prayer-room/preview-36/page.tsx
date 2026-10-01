// Dev-only render of turn 36 (PRACTICE) against fixtures: 36a's afternoon,
// 36e on a phone, and the 36b/36c/36d drawers — the same components the
// PRACTICE tab renders, without a signed-in session or migration 224.
// Not reachable in production: the route 404s outside development.

import { notFound } from "next/navigation";
import Preview36 from "./preview";

export default function Preview36Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Preview36 />;
}
