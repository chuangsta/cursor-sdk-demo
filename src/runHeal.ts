import { Agent, type Run, type SDKMessage } from "@cursor/sdk";
import path from "node:path";
import {
  ensureIncidentDir,
  loadAgentState,
  loadIncident,
  reportStatus,
  saveAgentState,
  type Incident,
} from "./incident.js";
import { blastRadiusGate, loadBlastRadiusConfig } from "./blastRadius.js";
import { resolveModel } from "./model.js";
import { FileNotifier } from "./notifiers/fileNotifier.js";
import { SlackStubNotifier } from "./notifiers/slackStub.js";
import { buildHealPrompt, buildResumePrompt } from "./prompts.js";

export type HealOptions = {
  repoRoot: string;
  incidentPath: string;
  resume?: boolean;
  dryRun?: boolean;
  confirmBlastRadius?: boolean;
  /** Override estimated downstream count for gate testing / live extend */
  estimatedDownstream?: number;
};

export type HealResult = {
  incident: Incident;
  agentId: string;
  modelNote: string;
  usedRouter: boolean;
  status: "passed" | "failed" | "unknown";
};

function requireApiKey(): string {
  const key = process.env.CURSOR_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "CURSOR_API_KEY is required. Copy .env.example to .env and set your key.",
    );
  }
  return key;
}

function logStreamEvent(event: SDKMessage): void {
  switch (event.type) {
    case "assistant":
      for (const part of event.message.content) {
        if (part.type === "text") {
          process.stdout.write(part.text);
        } else if (part.type === "tool_use") {
          console.log(`\n[tool_use] ${part.name}`);
        }
      }
      break;
    case "thinking":
      process.stdout.write(".");
      break;
    case "tool_call":
      console.log(`\n[tool_call] ${event.name} ${event.status}`);
      break;
    case "status":
      console.log(`\n[status] ${event.status}`);
      break;
    default:
      break;
  }
}

async function streamRun(run: Run): Promise<void> {
  for await (const event of run.stream()) {
    logStreamEvent(event);
  }
  process.stdout.write("\n");
  const result = await run.wait();
  if (result.status === "error") {
    throw new Error(result.error?.message ?? "Agent run failed");
  }
}

export async function runHeal(options: HealOptions): Promise<HealResult> {
  const incidentPath = path.isAbsolute(options.incidentPath)
    ? options.incidentPath
    : path.join(options.repoRoot, options.incidentPath);
  const incident = await loadIncident(incidentPath);
  await ensureIncidentDir(options.repoRoot, incident.id);

  const dryRun =
    options.dryRun === true || process.env.HEAL_DRY_RUN === "1";
  const confirmBlastRadius = options.confirmBlastRadius === true;
  const blastCfg = await loadBlastRadiusConfig(options.repoRoot);
  const estimatedDownstream =
    options.estimatedDownstream ?? blastCfg.maxDownstreamObjects;
  const gate = blastRadiusGate({
    estimatedDownstream,
    maxDownstreamObjects: blastCfg.maxDownstreamObjects,
    confirmBlastRadius,
  });

  console.log(`[heal] incident=${incident.id} severity=${incident.severity}`);
  console.log(`[heal] dryRun=${dryRun}`);
  console.log(`[heal] blast-radius: ${gate.reason}`);

  const notifiers = [
    new FileNotifier(options.repoRoot),
    new SlackStubNotifier(),
  ];

  // Gate runs before API key so live-extend blast demos work offline.
  if (!gate.allowed && !dryRun) {
    for (const n of notifiers) {
      await n.notify({
        incidentId: incident.id,
        status: "blocked",
        summary: gate.reason,
      });
    }
    throw new Error(gate.reason);
  }

  const apiKey = requireApiKey();
  const resolved = await resolveModel({
    apiKey,
    severity: incident.severity,
    optimizeForOverride: incident.optimize_for,
  });
  console.log(`[heal] ${resolved.note}`);

  const existing = options.resume
    ? await loadAgentState(options.repoRoot, incident.id)
    : null;

  if (options.resume && !existing?.agentId) {
    throw new Error(
      `No agent.json for incident ${incident.id}. Run without --resume first.`,
    );
  }

  const prompt = options.resume
    ? buildResumePrompt(incident)
    : buildHealPrompt({
        incident,
        dryRun,
        confirmBlastRadius,
        blastRadiusNote: gate.reason,
        modelNote: resolved.note,
      });

  let agentId: string;

  if (existing?.agentId) {
    console.log(`[heal] resuming agent ${existing.agentId}`);
    await using agent = await Agent.resume(existing.agentId, {
      apiKey,
      model: resolved.model,
      local: { cwd: options.repoRoot },
    });
    agentId = existing.agentId;
    const run = await agent.send(prompt);
    await streamRun(run);
    await saveAgentState(options.repoRoot, incident.id, {
      agentId,
      modelId: resolved.model.id,
      optimizeFor: resolved.optimizeFor,
      usedRouter: resolved.usedRouter,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    });
  } else {
    await using agent = await Agent.create({
      apiKey,
      model: resolved.model,
      local: { cwd: options.repoRoot },
    });
    agentId = agent.agentId;
    console.log(`[heal] created agent ${agentId}`);
    await saveAgentState(options.repoRoot, incident.id, {
      agentId,
      modelId: resolved.model.id,
      optimizeFor: resolved.optimizeFor,
      usedRouter: resolved.usedRouter,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const run = await agent.send(prompt);
    await streamRun(run);
    await saveAgentState(options.repoRoot, incident.id, {
      agentId,
      modelId: resolved.model.id,
      optimizeFor: resolved.optimizeFor,
      usedRouter: resolved.usedRouter,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const status = await reportStatus(options.repoRoot, incident.id);
  console.log(`[heal] REPORT status=${status}`);
  console.log(
    `[heal] report path=incidents/${incident.id}/REPORT.md`,
  );

  for (const n of notifiers) {
    await n.notify({
      incidentId: incident.id,
      status,
      summary: `Heal finished with status=${status}`,
      reportPath: `incidents/${incident.id}/REPORT.md`,
      agentId,
    });
  }

  return {
    incident,
    agentId,
    modelNote: resolved.note,
    usedRouter: resolved.usedRouter,
    status,
  };
}
