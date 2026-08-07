import { Cursor } from "@cursor/sdk";

export type OptimizeFor = "cost" | "balanced" | "intelligence";

export type ResolvedModel = {
  model: {
    id: string;
    params?: Array<{ id: string; value: string }>;
  };
  usedRouter: boolean;
  optimizeFor?: OptimizeFor;
  note: string;
};

const FALLBACK_MODEL =
  process.env.CURSOR_MODEL_FALLBACK?.trim() || "composer-2.5";

/**
 * Prefer Cursor Router (`auto-smart`) when the API key's team has it enabled.
 * Fall back to a pinned model so demos still run on personal accounts.
 */
export async function resolveModel(options: {
  apiKey: string;
  severity: "P1" | "P2" | "P3";
  optimizeForOverride?: OptimizeFor;
}): Promise<ResolvedModel> {
  const optimizeFor: OptimizeFor =
    options.optimizeForOverride ??
    (options.severity === "P1" ? "intelligence" : "balanced");

  try {
    const models = await Cursor.models.list({ apiKey: options.apiKey });
    const router = models.find((model) => model.id === "auto-smart");
    if (router) {
      const param = router.parameters?.find((p) => p.id === "optimize_for");
      const allowed =
        param?.values?.map((v) => v.value) ??
        (["cost", "balanced", "intelligence"] as const);
      const value = (allowed as string[]).includes(optimizeFor)
        ? optimizeFor
        : "balanced";
      return {
        model: {
          id: "auto-smart",
          params: [{ id: "optimize_for", value }],
        },
        usedRouter: true,
        optimizeFor: value as OptimizeFor,
        note: `Cursor Router available — using auto-smart optimize_for=${value}`,
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[model] Cursor.models.list failed: ${message}`);
  }

  return {
    model: { id: FALLBACK_MODEL },
    usedRouter: false,
    note: `Router (auto-smart) unavailable — falling back to pinned model ${FALLBACK_MODEL}`,
  };
}
