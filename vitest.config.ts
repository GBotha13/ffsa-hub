import { configDefaults, defineConfig } from "vitest/config";
import fs from "node:fs";
import path from "node:path";

// Fleet's rule tests run on the old Fleet app's real data (vehicles-module/seed).
// That data is FFSA's own (VINs, insurer details, workshop reports), so it is never
// committed: it lives only on the machines that have a copy. Where it's missing,
// the tests that load it (through src/lib/fleet/testing/seed.ts) are skipped.
const HAS_FLEET_SEED = fs.existsSync(path.resolve(__dirname, "vehicles-module/seed/db/fleet.json"));
function fleetSeedTests(dir = path.resolve(__dirname, "src")): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...fleetSeedTests(full));
    else if (/\.test\.tsx?$/.test(e.name) && /testing\/seed["']/.test(fs.readFileSync(full, "utf8")))
      out.push(path.relative(__dirname, full));
  }
  return out;
}
const skippedFleetTests = HAS_FLEET_SEED ? [] : fleetSeedTests();
if (skippedFleetTests.length)
  console.warn(`[vitest] vehicles-module/seed is not on this machine: skipping ${skippedFleetTests.length} Fleet test files that need it.`);

// Vitest doesn't read tsconfig paths, so the "@/…" alias the app uses has to
// be declared here too — without it any test whose import chain reaches an
// "@/" import fails to resolve.
export default defineConfig({
  // Next keeps "jsx": "preserve" for its compiler. Vitest's oxc transform
  // follows that and then refuses the raw JSX, so component tests opt into
  // the automatic runtime here.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    // apps/mobile is a separate Expo app with its own Jest setup.
    // vehicles-module/ is the FFSA Fleet reference app with its own node:test suite
    // (cd vehicles-module && npm test).
    exclude: [...configDefaults.exclude, "apps/**", "vehicles-module/**", ...skippedFleetTests],
  },
});
