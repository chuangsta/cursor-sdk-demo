import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

export type BlastRadiusConfig = {
  maxDownstreamObjects: number;
  downstreamSchemas: string[];
};

export async function loadBlastRadiusConfig(
  repoRoot: string,
): Promise<BlastRadiusConfig> {
  const raw = await readFile(
    path.join(repoRoot, "pipeline", "contract.yaml"),
    "utf8",
  );
  const doc = parseYaml(raw) as {
    blast_radius?: {
      max_downstream_objects?: number;
      downstream_schemas?: string[];
    };
    dbt?: { project_dir?: string };
  };
  return {
    maxDownstreamObjects: doc.blast_radius?.max_downstream_objects ?? 3,
    downstreamSchemas: doc.blast_radius?.downstream_schemas ?? [
      "DBT_DEV",
      "CURATED",
      "META",
    ],
  };
}

/**
 * Live-extend seam: when confirmed=false and estimated downstream count
 * exceeds the contract threshold, the orchestrator refuses to heal.
 * The agent is still instructed to measure true blast radius via Cortex RO.
 */
export function blastRadiusGate(options: {
  estimatedDownstream: number;
  maxDownstreamObjects: number;
  confirmBlastRadius: boolean;
}): { allowed: boolean; reason: string } {
  if (options.confirmBlastRadius) {
    return {
      allowed: true,
      reason: "Blast-radius confirmation flag provided (--confirm-blast-radius)",
    };
  }
  if (options.estimatedDownstream > options.maxDownstreamObjects) {
    return {
      allowed: false,
      reason: `Estimated downstream objects (${options.estimatedDownstream}) exceed max_downstream_objects (${options.maxDownstreamObjects}). Re-run with --confirm-blast-radius after review.`,
    };
  }
  return {
    allowed: true,
    reason: `Estimated downstream (${options.estimatedDownstream}) within threshold (${options.maxDownstreamObjects})`,
  };
}
