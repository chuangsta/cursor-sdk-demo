import type { Incident } from "./incident.js";

export function buildHealPrompt(options: {
  incident: Incident;
  dryRun: boolean;
  confirmBlastRadius: boolean;
  blastRadiusNote: string;
  modelNote: string;
}): string {
  const { incident } = options;
  const dry = options.dryRun
    ? "HEAL_DRY_RUN is ON — investigate and write REPORT.md only. Do NOT edit dbt_heal/**."
    : "You may edit dbt_heal/models/** and incidents/<id>/** only.";

  const blast = options.confirmBlastRadius
    ? "User confirmed blast radius (--confirm-blast-radius). Proceed with heal after measuring downstream objects."
    : `Blast-radius gate: ${options.blastRadiusNote}. If RO checks find more downstream objects than contract.blast_radius.max_downstream_objects, STOP healing and document the block in REPORT.md.`;

  return `You are the orchestrator for a self-healing Snowflake + dbt data pipeline.

## Incident
- id: ${incident.id}
- severity: ${incident.severity}
- pipeline: ${incident.pipeline}
- database: ${incident.database}
- error_message: ${incident.error_message}
- staging_hint: ${incident.hints?.staging_table ?? "HEAL_DEMO.STAGING.ORDERS"}
- curated_hint: ${incident.hints?.curated_table ?? "HEAL_DEMO.DBT_DEV.ORDERS_DAILY"}
- contract: ${incident.hints?.contract_path ?? "pipeline/contract.yaml"}
- dbt_project: ${incident.hints?.dbt_project ?? "dbt_heal"}
- dbt_model: ${incident.hints?.dbt_model ?? "orders_daily"}
- sql: ${incident.hints?.sql_path ?? "dbt_heal/models/marts/orders_daily.sql"}

## Model selection note
${options.modelNote}

## Policy
${dry}
${blast}
- Snowflake: cortex-code RO, or \`npx tsx src/sf.ts sql\` if Cortex print/headless is unavailable. Never DEPLOY. Never DDL/DML Snowflake.
- Heal in git only under \`dbt_heal/models/**\`.
- Runtime is **local SDK** (not cloud agents).

## Mandatory multi-agent workflow
You MUST delegate with the Agent/Task tool in this exact order (do not collapse into one agent):
1. **investigator** — RO diagnosis + blast radius
2. **healer** — patch dbt SQL/yml model definitions (skip edits if dry-run)
3. **docs_sync** — align column descriptions/tests in yml (skip if dry-run)
4. **test_runner** — \`npm run dbt:compile\` and \`npm run dbt:test\` (\`scripts/dbt.sh\` auto-adds \`.venv/bin\`)
5. **verifier** — RO + dbt results → final status
6. Write \`incidents/${incident.id}/REPORT.md\` including **Agents invoked**
   End with \`status: passed\` or \`status: failed\`.

## After healing
- Do NOT run DDL against Snowflake. Human/CI applies with \`npm run dbt:run\`.
- If dbt test fails only because source column tests still say \`amount\`, healer/docs_sync must update \`sources.yml\` + staging/marts yml together.

## Classification
schema_drift | data_quality | runtime | unknown — usually schema_drift for invalid identifier amount.

Start now. Stream progress and name each subagent when you invoke it.`;
}

export function buildResumePrompt(incident: Incident): string {
  return `Resume healing incident ${incident.id} (dbt + multi-agent).

Continue from where you left off:
1. Read incidents/${incident.id}/REPORT.md if present
2. Finish remaining steps in order: investigator → healer → docs_sync → test_runner → verifier
3. Ensure REPORT.md exists with Agents invoked and final status: passed|failed

Snowflake remains RO-only. Only edit dbt_heal/models/** and incidents/${incident.id}/**.`;
}
