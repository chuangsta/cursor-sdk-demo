#!/usr/bin/env node
/**
 * Hybrid Stage 2: after a local heal, open a GitHub PR for human review.
 * Merge is the approval gate; CI may then `dbt run` (see .github/workflows).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { Incident } from "./incident.js";
import { incidentDir } from "./incident.js";

export type PublishPrOptions = {
  repoRoot: string;
  incident: Incident;
  status: "passed" | "failed" | "unknown";
  /** When true, print actions only */
  dryRun?: boolean;
  baseBranch?: string;
};

export type PublishPrResult = {
  skipped?: string;
  branch?: string;
  prUrl?: string;
  committed?: boolean;
};

function run(
  repoRoot: string,
  command: string,
  args: string[],
  opts?: { allowFail?: boolean },
): { code: number; stdout: string; stderr: string } {
  const r = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env,
  });
  const code = r.status ?? 1;
  const stdout = r.stdout?.toString() ?? "";
  const stderr = r.stderr?.toString() ?? "";
  if (code !== 0 && !opts?.allowFail) {
    throw new Error(
      `${command} ${args.join(" ")} failed (${code}): ${stderr || stdout}`,
    );
  }
  return { code, stdout, stderr };
}

function git(repoRoot: string, args: string[], opts?: { allowFail?: boolean }) {
  return run(repoRoot, "git", args, opts);
}

function branchNameFor(incidentId: string): string {
  const safe = incidentId
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `heal/${safe || "incident"}`;
}

async function hasModelDiffs(repoRoot: string): Promise<boolean> {
  const staged = git(repoRoot, ["diff", "--name-only", "--", "dbt_heal/models"], {
    allowFail: true,
  });
  const unstaged = git(
    repoRoot,
    ["diff", "--name-only", "--cached", "--", "dbt_heal/models"],
    { allowFail: true },
  );
  const untracked = git(
    repoRoot,
    ["ls-files", "--others", "--exclude-standard", "--", "dbt_heal/models"],
    { allowFail: true },
  );
  const names = new Set(
    [...staged.stdout.split("\n"), ...unstaged.stdout.split("\n"), ...untracked.stdout.split("\n")]
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return names.size > 0;
}

async function buildPrBody(
  repoRoot: string,
  incident: Incident,
  status: string,
): Promise<string> {
  const reportPath = path.join(incidentDir(repoRoot, incident.id), "REPORT.md");
  let reportExcerpt = "";
  try {
    const full = await readFile(reportPath, "utf8");
    reportExcerpt = full.slice(0, 4000);
  } catch {
    reportExcerpt = "_REPORT.md not found_";
  }

  return `## Summary
Self-heal for incident \`${incident.id}\` (status: **${status}**).

- Pipeline: \`${incident.pipeline}\`
- Database: \`${incident.database}\`
- Error: ${incident.error_message}

## Review
- Diff is limited to \`dbt_heal/models/**\` (+ incident REPORT when present).
- **Merge = approve apply.** CI \`dbt-apply\` runs \`dbt run\` on push to the base branch when \`dbt_heal/**\` changes.
- Agents remain Snowflake RO; this PR does not DDL/DML prod.

## REPORT (excerpt)

\`\`\`markdown
${reportExcerpt}
\`\`\`
`;
}

/**
 * Create branch, commit dbt model heal, push, open PR via `gh`.
 */
export async function publishHealPr(
  options: PublishPrOptions,
): Promise<PublishPrResult> {
  const base = options.baseBranch ?? process.env.HEAL_PR_BASE ?? "master";
  const branch = branchNameFor(options.incident.id);

  if (options.dryRun) {
    return { skipped: "dry-run", branch };
  }

  if (options.status === "failed") {
    return { skipped: "heal status=failed — not opening PR" };
  }

  const gh = run(options.repoRoot, "gh", ["auth", "status"], { allowFail: true });
  if (gh.code !== 0) {
    return {
      skipped: "gh not authenticated — run `gh auth login` then retry with --create-pr",
    };
  }

  if (!(await hasModelDiffs(options.repoRoot))) {
    return { skipped: "no dbt_heal/models changes to publish" };
  }

  // Capture model file contents (works even when branching off origin/base)
  const modelFiles = git(
    options.repoRoot,
    ["ls-files", "--", "dbt_heal/models"],
    { allowFail: true },
  )
    .stdout.split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  // Also include untracked under models
  const untrackedModels = git(
    options.repoRoot,
    ["ls-files", "--others", "--exclude-standard", "--", "dbt_heal/models"],
    { allowFail: true },
  )
    .stdout.split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const allModelPaths = [...new Set([...modelFiles, ...untrackedModels])];
  const snapshots = new Map<string, string>();
  for (const rel of allModelPaths) {
    try {
      snapshots.set(rel, await readFile(path.join(options.repoRoot, rel), "utf8"));
    } catch {
      /* skip */
    }
  }

  const reportAbs = path.join(
    incidentDir(options.repoRoot, options.incident.id),
    "REPORT.md",
  );
  let reportText: string | undefined;
  try {
    reportText = await readFile(reportAbs, "utf8");
  } catch {
    /* optional */
  }

  if (snapshots.size === 0) {
    return { skipped: "could not snapshot dbt_heal/models files" };
  }

  git(options.repoRoot, ["fetch", "origin", base], { allowFail: true });
  const baseRef = git(
    options.repoRoot,
    ["rev-parse", "--verify", `origin/${base}`],
    { allowFail: true },
  );
  const startPoint = baseRef.code === 0 ? `origin/${base}` : base;

  const originalBranch = git(options.repoRoot, ["branch", "--show-current"], {
    allowFail: true,
  }).stdout.trim();

  // Stash unrelated WIP so checkout can proceed; heal files are snapshotted above
  const dirty =
    git(options.repoRoot, ["status", "--porcelain"], { allowFail: true })
      .stdout.trim().length > 0;
  let stashed = false;
  if (dirty) {
    const stash = git(
      options.repoRoot,
      ["stash", "push", "-u", "-m", `publish-pr-wip-${options.incident.id}`],
      { allowFail: true },
    );
    stashed = stash.code === 0 && !/No local changes/i.test(stash.stdout);
  }

  try {
    const exists = git(options.repoRoot, ["rev-parse", "--verify", branch], {
      allowFail: true,
    });
    if (exists.code === 0) {
      git(options.repoRoot, ["checkout", branch]);
      git(options.repoRoot, ["reset", "--hard", startPoint]);
    } else {
      git(options.repoRoot, ["checkout", "-B", branch, startPoint]);
    }

    for (const [rel, content] of snapshots) {
      const abs = path.join(options.repoRoot, rel);
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, content);
    }

    if (reportText) {
      const reportOut = path.join(
        options.repoRoot,
        "incidents",
        options.incident.id,
        "REPORT.md",
      );
      await mkdir(path.dirname(reportOut), { recursive: true });
      await writeFile(reportOut, reportText);
    }

    git(options.repoRoot, ["add", "--", "dbt_heal/models"]);
    const reportRel = path.join("incidents", options.incident.id, "REPORT.md");
    git(options.repoRoot, ["add", "-f", "--", reportRel], { allowFail: true });

    const staged = git(options.repoRoot, ["diff", "--cached", "--name-only"]);
    if (!staged.stdout.trim()) {
      return { skipped: "nothing staged after add", branch };
    }

    const msg = `heal(${options.incident.id}): align dbt models after schema drift`;
    // Prefer system git to avoid wrapper --trailer issues on older git
    const commit = spawnSync("/usr/bin/git", ["commit", "-m", msg], {
      cwd: options.repoRoot,
      encoding: "utf8",
      env: process.env,
    });
    if ((commit.status ?? 1) !== 0) {
      const fallback = git(options.repoRoot, ["commit", "-m", msg], {
        allowFail: true,
      });
      if (fallback.code !== 0) {
        throw new Error(`commit failed: ${commit.stderr || fallback.stderr}`);
      }
    }

    // Heal branches are reset to base then recommitted; force-with-lease updates
    // an existing remote PR branch on rehearsal republish without a blind --force.
    git(options.repoRoot, [
      "push",
      "--force-with-lease",
      "-u",
      "origin",
      "HEAD",
    ]);

    const title = `heal: ${options.incident.pipeline} (${options.incident.id})`;
    const body = await buildPrBody(
      options.repoRoot,
      options.incident,
      options.status,
    );
    const bodyFile = path.join(
      incidentDir(options.repoRoot, options.incident.id),
      "pr-body.md",
    );
    await writeFile(bodyFile, body);

    const created = run(
      options.repoRoot,
      "gh",
      [
        "pr",
        "create",
        "--base",
        base,
        "--head",
        branch,
        "--title",
        title,
        "--body-file",
        bodyFile,
      ],
      { allowFail: true },
    );

    let prUrl = created.stdout.trim().split("\n").filter(Boolean).pop();
    if (created.code !== 0) {
      // Already exists — try to resolve URL
      const view = run(
        options.repoRoot,
        "gh",
        ["pr", "view", branch, "--json", "url", "-q", ".url"],
        { allowFail: true },
      );
      if (view.code === 0 && view.stdout.trim()) {
        prUrl = view.stdout.trim();
        console.log(`[publish-pr] PR already open: ${prUrl}`);
      } else {
        throw new Error(
          `gh pr create failed: ${created.stderr || created.stdout}`,
        );
      }
    }

    const meta = {
      branch,
      prUrl,
      base,
      createdAt: new Date().toISOString(),
      incidentId: options.incident.id,
      status: options.status,
    };
    await writeFile(
      path.join(incidentDir(options.repoRoot, options.incident.id), "pr.json"),
      JSON.stringify(meta, null, 2),
    );

    console.log(`[publish-pr] branch=${branch}`);
    console.log(`[publish-pr] pr=${prUrl}`);
    return { branch, prUrl, committed: true };
  } finally {
    restoreWorkspace(options.repoRoot, originalBranch, stashed);
  }
}

/** Return to the caller's branch and re-apply their stashed work. */
function restoreWorkspace(
  repoRoot: string,
  originalBranch: string,
  stashed: boolean,
): void {
  if (originalBranch) {
    const back = git(repoRoot, ["checkout", originalBranch], {
      allowFail: true,
    });
    if (back.code !== 0) {
      console.warn(
        `[publish-pr] could not return to ${originalBranch}: ${back.stderr.trim()}`,
      );
      return;
    }
  }
  if (stashed) {
    const pop = git(repoRoot, ["stash", "pop"], { allowFail: true });
    if (pop.code !== 0) {
      console.warn(
        `[publish-pr] stash pop failed — your work is still in \`git stash list\`: ${pop.stderr.trim()}`,
      );
    }
  }
}

/** True when CLI/env requests PR publishing. */
export function shouldCreatePr(flag?: boolean): boolean {
  if (flag === true) return true;
  if (flag === false) return false;
  return process.env.HEAL_CREATE_PR === "1";
}

