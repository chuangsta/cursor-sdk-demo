#!/usr/bin/env node
/**
 * Publish a GitHub PR for an already-healed incident (dbt_heal/models diff).
 *
 *   npm run heal:pr -- --incident inc-schema-drift-watch-...
 *   npm run heal:pr -- --incident fixtures/incidents/schema-drift.json
 */
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadIncident, reportStatus } from "./incident.js";
import { publishHealPr } from "./publishPr.js";

async function main() {
  const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  let incidentArg = "fixtures/incidents/schema-drift.json";
  let statusOverride: "passed" | "failed" | "unknown" | undefined;

  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === "--incident") incidentArg = process.argv[++i] ?? incidentArg;
    else if (a === "--status") {
      statusOverride = process.argv[++i] as typeof statusOverride;
    } else if (a === "--help" || a === "-h") {
      console.log(`Usage: npm run heal:pr -- --incident <id|path> [--status passed|failed|unknown]`);
      process.exit(0);
    }
  }

  let resolved = incidentArg;
  if (!incidentArg.includes("/") && !incidentArg.endsWith(".json")) {
    resolved = path.join("incidents", incidentArg, "trigger.json");
  }
  const abs = path.isAbsolute(resolved)
    ? resolved
    : path.join(repoRoot, resolved);
  const incident = await loadIncident(abs);
  const status =
    statusOverride ?? (await reportStatus(repoRoot, incident.id));

  const result = await publishHealPr({
    repoRoot,
    incident,
    status,
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.prUrl) process.exitCode = 2;
}

main().catch((err) => {
  console.error(`[heal:pr] ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
