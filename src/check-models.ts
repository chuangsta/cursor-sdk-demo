#!/usr/bin/env node
import "dotenv/config";
import { Cursor } from "@cursor/sdk";
import { resolveModel } from "./model.js";

async function main() {
  const apiKey = process.env.CURSOR_API_KEY?.trim();
  if (!apiKey) {
    console.error("Set CURSOR_API_KEY in .env");
    process.exit(1);
  }

  console.log("Listing models…");
  try {
    const models = await Cursor.models.list({ apiKey });
    for (const m of models) {
      const params =
        m.parameters?.map(
          (p) =>
            `${p.id}=[${(p.values ?? []).map((v) => v.value).join(",")}]`,
        ) ?? [];
      console.log(`- ${m.id}${params.length ? ` (${params.join("; ")})` : ""}`);
    }
    const router = models.find((m) => m.id === "auto-smart");
    console.log(
      router
        ? "\nRouter: auto-smart is AVAILABLE"
        : "\nRouter: auto-smart NOT in catalog (will use pinned fallback)",
    );
  } catch (err) {
    console.error("Cursor.models.list failed:", err);
  }

  const resolved = await resolveModel({ apiKey, severity: "P2" });
  console.log("\nResolved for P2:", resolved);
}

main();
