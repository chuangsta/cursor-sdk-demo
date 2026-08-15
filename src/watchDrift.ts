#!/usr/bin/env node
/**
 * Phase 1 auto-trigger: poll STAGING.ORDERS columns (RO) and POST /incidents
 * when amount → order_amount drift is detected.
 *
 * Prerequisites:
 *   Terminal 1: npm run server
 *   Terminal 2: npm run watch:drift
 * Then ALTER (or npm run sf:break) in Snowflake / Snowsight.
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { IncidentSchema, type Incident } from "./incident.js";
import { executeSql } from "./snowflakeRo.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

type Args = {
  intervalSec: number;
  once: boolean;
  dryRun: boolean;
  url: string;
  incidentPath: string;
  database: string;
  schema: string;
  table: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    intervalSec: Number(process.env.WATCH_INTERVAL_SEC ?? 15),
    once: false,
    dryRun: false,
    url: process.env.HEAL_SERVER_URL ?? "http://127.0.0.1:8787/incidents",
    incidentPath: "fixtures/incidents/schema-drift.json",
    database: "HEAL_DEMO",
    schema: "STAGING",
    table: "ORDERS",
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--once") args.once = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--interval") {
      args.intervalSec = Number(argv[++i] ?? args.intervalSec);
    } else if (a === "--url") {
      args.url = argv[++i] ?? args.url;
    } else if (a === "--incident") {
      args.incidentPath = argv[++i] ?? args.incidentPath;
    } else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (!Number.isFinite(args.intervalSec) || args.intervalSec < 1) {
    throw new Error("--interval must be >= 1 seconds");
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run watch:drift -- [options]

Poll HEAL_DEMO.STAGING.ORDERS for schema drift (ORDER_AMOUNT present, AMOUNT absent).
On first detect, POST an incident to the heal server (npm run server).

Options:
  --interval <sec>   Poll interval (default: 15, or WATCH_INTERVAL_SEC)
  --once             Check once and exit (0 = green, 2 = drift posted/detected)
  --dry-run          Detect only; do not POST
  --url <url>        Incident webhook (default: http://127.0.0.1:8787/incidents)
  --incident <path>  Template JSON (default: fixtures/incidents/schema-drift.json)
`);
}

type ColumnRow = { COLUMN_NAME: string };

async function listOrdersColumns(
  database: string,
  schema: string,
  table: string,
): Promise<Set<string>> {
  const rows = await executeSql<ColumnRow>(
    `SELECT COLUMN_NAME
     FROM ${database}.INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = '${schema}'
       AND TABLE_NAME = '${table}'
       AND COLUMN_NAME IN ('AMOUNT', 'ORDER_AMOUNT')`,
  );
  return new Set(rows.map((r) => String(r.COLUMN_NAME).toUpperCase()));
}

function isDrift(cols: Set<string>): boolean {
  return cols.has("ORDER_AMOUNT") && !cols.has("AMOUNT");
}

async function loadIncidentTemplate(relPath: string): Promise<Incident> {
  const abs = path.isAbsolute(relPath)
    ? relPath
    : path.join(repoRoot, relPath);
  const raw = JSON.parse(await readFile(abs, "utf8"));
  const parsed = IncidentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid incident template: ${parsed.error.message}`);
  }
  return parsed.data;
}

function buildTriggeredIncident(template: Incident, cols: Set<string>): Incident {
  const stamp = new Date().toISOString();
  const idStamp = stamp.replace(/[:.]/g, "-");
  const colList = [...cols].sort().join(",");
  return {
    ...template,
    id: `inc-schema-drift-watch-${idStamp}`,
    failed_at: stamp,
    source: "watch-schema-drift",
    error_message: `Watcher detected schema drift on STAGING.ORDERS (columns: ${colList}): ORDER_AMOUNT present, AMOUNT missing — invalid identifier 'AMOUNT'`,
    hints: {
      ...template.hints,
      failure_class: "schema_drift",
    },
  };
}

async function postIncident(url: string, incident: Incident): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(incident),
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep text */
  }
  if (!res.ok) {
    throw new Error(
      `POST ${url} failed (${res.status}): ${typeof body === "string" ? body : JSON.stringify(body)}`,
    );
  }
  console.log("[watch:drift] heal accepted:", body);
}

async function checkOnce(args: Args): Promise<"green" | "drift"> {
  const cols = await listOrdersColumns(
    args.database,
    args.schema,
    args.table,
  );
  const status = [...cols].sort().join(",") || "(none)";
  console.log(
    `[watch:drift] ${args.database}.${args.schema}.${args.table} columns: ${status}`,
  );

  if (!isDrift(cols)) {
    console.log("[watch:drift] green (AMOUNT present or order_amount absent)");
    return "green";
  }

  console.log(
    "[watch:drift] DRIFT detected: ORDER_AMOUNT present, AMOUNT missing",
  );

  if (args.dryRun) {
    console.log("[watch:drift] --dry-run: not posting incident");
    return "drift";
  }

  const template = await loadIncidentTemplate(args.incidentPath);
  const incident = buildTriggeredIncident(template, cols);
  console.log(`[watch:drift] posting incident ${incident.id} → ${args.url}`);
  await postIncident(args.url, incident);
  return "drift";
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    `[watch:drift] url=${args.url} interval=${args.intervalSec}s once=${args.once} dryRun=${args.dryRun}`,
  );
  console.log(
    "[watch:drift] ensure heal server is up: npm run server  (unless --dry-run)",
  );

  if (args.once) {
    const result = await checkOnce(args);
    process.exitCode = result === "drift" ? 2 : 0;
    return;
  }

  let fired = false;
  for (;;) {
    try {
      if (!fired) {
        const result = await checkOnce(args);
        if (result === "drift") {
          fired = true;
          console.log(
            "[watch:drift] triggered once; watching continues but will not re-POST until restart (debounce). Ctrl+C to stop.",
          );
        }
      } else {
        const cols = await listOrdersColumns(
          args.database,
          args.schema,
          args.table,
        );
        console.log(
          `[watch:drift] debounced (already fired); columns=${[...cols].sort().join(",") || "(none)"}`,
        );
      }
    } catch (err) {
      console.error(
        `[watch:drift] poll error: ${err instanceof Error ? err.message : err}`,
      );
    }
    await sleep(args.intervalSec * 1000);
  }
}

main().catch((err) => {
  console.error(`[watch:drift] fatal: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
