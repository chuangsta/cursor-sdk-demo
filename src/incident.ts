import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const IncidentSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(["P1", "P2", "P3"]).default("P2"),
  pipeline: z.string().default("orders_daily"),
  database: z.string().default("HEAL_DEMO"),
  error_message: z.string().min(1),
  failed_at: z.string().optional(),
  source: z.string().optional(),
  optimize_for: z.enum(["cost", "balanced", "intelligence"]).optional(),
  hints: z
    .object({
      staging_table: z.string().optional(),
      curated_table: z.string().optional(),
      contract_path: z.string().optional(),
      sql_path: z.string().optional(),
      dbt_project: z.string().optional(),
      dbt_model: z.string().optional(),
    })
    .optional(),
});

export type Incident = z.infer<typeof IncidentSchema>;

export type AgentState = {
  agentId: string;
  modelId: string;
  optimizeFor?: string;
  usedRouter: boolean;
  createdAt: string;
  updatedAt: string;
};

export function incidentDir(repoRoot: string, incidentId: string): string {
  return path.join(repoRoot, "incidents", incidentId);
}

export async function loadIncident(filePath: string): Promise<Incident> {
  const raw = await readFile(filePath, "utf8");
  return IncidentSchema.parse(JSON.parse(raw));
}

export async function ensureIncidentDir(
  repoRoot: string,
  incidentId: string,
): Promise<string> {
  const dir = incidentDir(repoRoot, incidentId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function saveAgentState(
  repoRoot: string,
  incidentId: string,
  state: AgentState,
): Promise<void> {
  const dir = await ensureIncidentDir(repoRoot, incidentId);
  await writeFile(path.join(dir, "agent.json"), JSON.stringify(state, null, 2));
}

export async function loadAgentState(
  repoRoot: string,
  incidentId: string,
): Promise<AgentState | null> {
  try {
    const raw = await readFile(
      path.join(incidentDir(repoRoot, incidentId), "agent.json"),
      "utf8",
    );
    return JSON.parse(raw) as AgentState;
  } catch {
    return null;
  }
}

export async function reportStatus(
  repoRoot: string,
  incidentId: string,
): Promise<"passed" | "failed" | "unknown"> {
  try {
    const report = await readFile(
      path.join(incidentDir(repoRoot, incidentId), "REPORT.md"),
      "utf8",
    );
    if (/status:\s*passed/i.test(report)) return "passed";
    if (/status:\s*failed/i.test(report)) return "failed";
    return "unknown";
  } catch {
    return "unknown";
  }
}
