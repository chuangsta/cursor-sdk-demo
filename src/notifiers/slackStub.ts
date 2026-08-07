import type { HealNotification, Notifier } from "./types.js";

/**
 * Stub for live interview extension — wire Slack MCP / Web API later.
 * Does not send network traffic.
 */
export class SlackStubNotifier implements Notifier {
  async notify(event: HealNotification): Promise<void> {
    console.log(
      `[slack-stub] would post incident=${event.incidentId} status=${event.status}: ${event.summary}`,
    );
  }
}
