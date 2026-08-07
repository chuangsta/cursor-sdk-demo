import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { HealNotification, Notifier } from "./types.js";

export class FileNotifier implements Notifier {
  constructor(private readonly repoRoot: string) {}

  async notify(event: HealNotification): Promise<void> {
    const dir = path.join(this.repoRoot, "incidents", event.incidentId);
    await mkdir(dir, { recursive: true });
    const line = JSON.stringify({
      at: new Date().toISOString(),
      ...event,
    });
    await appendFile(path.join(dir, "notifications.jsonl"), `${line}\n`);
  }
}
