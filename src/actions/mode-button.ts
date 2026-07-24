import { action } from "@elgato/streamdeck";
import { ManagedAction } from "./base";

const MODE_LABELS: Record<string, string> = {
  default: "Default",
  acceptEdits: "Accept\nEdits",
  plan: "Plan",
  auto: "Auto",
  dontAsk: "Don't\nAsk",
  bypassPermissions: "Bypass",
};

/**
 * Shorten a model ID for button display. Handles both dotted-minor names
 * ("claude-sonnet-4-6" → "Sonnet 4.6") and major-only names
 * ("claude-fable-5" → "Fable 5").
 */
function shortenModel(model: string): string {
  const cleaned = model.replace(/^claude-/, "");
  const m = cleaned.match(/^([a-z]+)-(\d+)(?:-(\d+))?/);
  if (m) {
    const name = m[1].charAt(0).toUpperCase() + m[1].slice(1);
    const version = m[3] ? `${m[2]}.${m[3]}` : m[2];
    return `${name} ${version}`;
  }
  return cleaned.slice(0, 12);
}

@action({ UUID: "com.paultyng.agentsd.mode" })
export class ModeButton extends ManagedAction {
  protected render(): void {
    const session = this.manager?.activeSession;
    const modeLabel = MODE_LABELS[session?.permissionMode ?? ""] ?? session?.permissionMode ?? "—";
    const modelLabel = session?.model ? shortenModel(session.model) : "";
    const title = modelLabel ? `${modeLabel}\n${modelLabel}` : modeLabel;
    for (const act of this.actions) {
      act.setTitle(title);
    }
  }
}
