#!/usr/bin/env node
/**
 * RO Snowflake helpers when Cortex Code headless (-p) is unavailable
 * (e.g. trial/subscription accounts).
 *
 * Usage:
 *   npm run sf:whoami
 *   npm run sf:sql -- "SELECT 1"
 *   npm run sf:seed
 *   npm run sf:break
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { executeSql, loadSnowflakeConnection } from "./snowflakeRo.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

async function runFile(rel: string) {
  const sql = await readFile(path.join(repoRoot, rel), "utf8");
  // Split on semicolons at line ends — good enough for our fixture scripts
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.replace(/--.*$/gm, "").trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const stmt of statements) {
    const preview = stmt.replace(/\s+/g, " ").slice(0, 80);
    process.stdout.write(`> ${preview}…\n`);
    await executeSql(stmt);
  }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const cfg = await loadSnowflakeConnection();
  console.log(
    `[sf] connection=${cfg.name} account=${cfg.account} user=${cfg.username} db=${cfg.database ?? ""}`,
  );

  if (!cmd || cmd === "whoami") {
    const rows = await executeSql<{ ACCOUNT: string; USER_NAME: string }>(
      "SELECT CURRENT_ACCOUNT() AS account, CURRENT_USER() AS user_name",
    );
    console.log(rows);
    return;
  }

  if (cmd === "sql") {
    const sql = rest.join(" ");
    if (!sql) throw new Error("Provide SQL after sql");
    console.log(await executeSql(sql));
    return;
  }

  if (cmd === "seed") {
    await runFile("fixtures/snowflake/seed.sql");
    console.log("[sf] seed complete");
    return;
  }

  if (cmd === "break") {
    await runFile("fixtures/snowflake/break_schema_drift.sql");
    console.log("[sf] break complete");
    return;
  }

  if (cmd === "verify") {
    await runFile("fixtures/snowflake/verify_ro.sql");
    return;
  }

  throw new Error(`Unknown command: ${cmd}`);
}

main().catch((err) => {
  console.error(`[sf] error: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
