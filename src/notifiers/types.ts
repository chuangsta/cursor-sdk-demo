/** Live-extend seam: swap FileNotifier for Slack later without changing heal loop. */

export type HealNotification = {
  incidentId: string;
  status: "passed" | "failed" | "unknown" | "blocked";
  summary: string;
  reportPath?: string;
  agentId?: string;
};

export interface Notifier {
  notify(event: HealNotification): Promise<void>;
}
