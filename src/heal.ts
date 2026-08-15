#!/usr/bin/env node
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runHeal } from "./runHeal.js";

function parseArgs(argv: string[]) {
  const args = {
    incident: "fixtures/incidents/schema-drift.json",
    resume: false,
    dryRun: false,
    confirmBlastRadius: false,
    createPr: undefined as boolean | undefined,
    estimatedDownstream: undefined as number | undefined,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--resume") args.resume = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--confirm-blast-radius") args.confirmBlastRadius = true;
    else if (a === "--create-pr") args.createPr = true;
    else if (a === "--no-create-pr") args.createPr = false;
    else if (a === "--incident") {
      args.incident = argv[++i] ?? args.incident;
    } else if (a === "--estimated-downstream") {
      args.estimatedDownstream = Number(argv[++i]);
    } else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run heal -- [options]

Options:
  --incident <path>           Incident JSON (default: fixtures/incidents/schema-drift.json)
  --resume                    Resume prior agent for this incident id
  --dry-run                   Investigate only (also HEAL_DRY_RUN=1)
  --create-pr                 After heal, commit dbt_heal/models and open a GitHub PR
                              (also HEAL_CREATE_PR=1). Merge triggers CI dbt-apply.
  --no-create-pr              Disable PR even if HEAL_CREATE_PR=1
  --confirm-blast-radius      Allow heal when downstream count exceeds threshold
  --estimated-downstream <n>  Override estimated downstream count (live-extend / gate test)
`);
}

async function main() {
  const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const args = parseArgs(process.argv.slice(2));

  try {
    const result = await runHeal({
      repoRoot,
      incidentPath: args.incident,
      resume: args.resume,
      dryRun: args.dryRun,
      confirmBlastRadius: args.confirmBlastRadius,
      estimatedDownstream: args.estimatedDownstream,
      createPr: args.createPr,
    });
    if (result.prUrl) console.log(`[heal] review PR: ${result.prUrl}`);
    if (result.status === "failed") {
      process.exitCode = 2;
    }
  } catch (err) {
    console.error(`[heal] error: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  }
}

main();
