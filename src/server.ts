#!/usr/bin/env node
import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { IncidentSchema } from "./incident.js";
import { runHeal } from "./runHeal.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const port = Number(process.env.PORT ?? 8787);

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));

app.post("/incidents", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = IncidentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const incident = parsed.data;
  const confirmBlastRadius =
    c.req.query("confirm_blast_radius") === "1" ||
    c.req.header("x-confirm-blast-radius") === "1";
  const dryRun =
    process.env.HEAL_DRY_RUN === "1" || c.req.query("dry_run") === "1";
  const createPr =
    process.env.HEAL_CREATE_PR === "1" ||
    c.req.query("create_pr") === "1" ||
    c.req.header("x-create-pr") === "1";

  const incidentPath = path.join(
    repoRoot,
    "incidents",
    incident.id,
    "trigger.json",
  );
  await mkdir(path.dirname(incidentPath), { recursive: true });
  await writeFile(incidentPath, JSON.stringify(incident, null, 2));

  // Fire-and-forget style for async demo feel; await for simpler local demo reliability
  try {
    const result = await runHeal({
      repoRoot,
      incidentPath,
      dryRun,
      confirmBlastRadius,
      createPr,
    });
    return c.json({
      ok: true,
      incidentId: incident.id,
      agentId: result.agentId,
      status: result.status,
      usedRouter: result.usedRouter,
      modelNote: result.modelNote,
      report: `incidents/${incident.id}/REPORT.md`,
      prUrl: result.prUrl,
      prSkipped: result.prSkipped,
    });
  } catch (err) {
    return c.json(
      {
        ok: false,
        incidentId: incident.id,
        error: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
});

console.log(`[server] listening on http://127.0.0.1:${port}`);
console.log(`[server] POST /incidents  GET /health`);

serve({ fetch: app.fetch, port });
