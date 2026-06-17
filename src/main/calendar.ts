import { spawnSync } from "child_process";
import { clipboard } from "electron";

export interface OsascriptResult {
  success: boolean;
  output: string;
  error?: string;
}

export function execOsascript(script: string): OsascriptResult {
  const result = spawnSync("osascript", ["-e", script], {
    encoding: "utf8",
    timeout: 30_000,
  });
  if (result.error) {
    return { success: false, output: "", error: result.error.message };
  }
  if (result.status !== 0) {
    return {
      success: false,
      output: result.stdout ?? "",
      error: result.stderr?.trim() || `osascript exited with code ${result.status}`,
    };
  }
  return { success: true, output: result.stdout?.trim() ?? "" };
}

export function readClipboardImage(): string | null {
  const img = clipboard.readImage();
  if (img.isEmpty()) return null;
  return img.toDataURL();
}

const SYSTEM_PROMPT = `You are a macOS calendar assistant. The user will describe one or more events and you must generate a single osascript heredoc command that creates those events in Apple Calendar.

## Rules

### Date building
ALWAYS build dates programmatically. NEVER use date string parsing (it fails on this Mac's locale). Use:
  set d to (current date)
  set year of d to 2026
  set month of d to June
  set day of d to 17
  set hours of d to 8
  set minutes of d to 0
  set seconds of d to 0

### Event format
- Title: lead with emoji icon (🚌 bus, 🚆 train, 🚗 car, ✈️ flight, ⚽️ match)
- Format: \`🚌 261 Sætre → Røyken stasjon\`
- En-dash (–) for matches, not hyphen
- Walking legs before/after transit go in the description, NOT as separate events

### Description
Include walking legs as:
  Før: 4 min gange fra X til Y

  [transit details]

  Etter: 22 min gange (1,0 mi) til [destination] (ankomst HH:MM)

### Calendars
- Transport — buses, trains, flights for getting around
- Important — flights, bookings with references
- Remember — matches to watch
- VM — World Cup 2026 matches

### Alarms
- Transit: 10-minute reminder (\`trigger interval:-10\`)
- Flights: 2-hour reminder (\`trigger interval:-120\`)
- Matches: NO reminders (except 1-hour for Norway matches)
- Must \`set evtN to make new event...\` when adding an alarm (to reference the event)

### Template
\`\`\`
osascript <<'EOF'
tell application "Calendar"
  tell calendar "CALENDAR_NAME"
    set d1start to (current date)
    set year of d1start to YYYY
    set month of d1start to MonthName
    set day of d1start to DD
    set hours of d1start to HH
    set minutes of d1start to MM
    set seconds of d1start to 0
    set d1end to d1start + NN * minutes

    set evt1 to make new event with properties {¬
      summary:"TITLE", ¬
      start date:d1start, ¬
      end date:d1end, ¬
      location:"LOCATION", ¬
      description:"DESCRIPTION"}
    tell evt1 to make new display alarm at end with properties {trigger interval:-10}
  end tell
end tell
EOF
\`\`\`

### Important
- The ¬ character is AppleScript's line-continuation (U+00AC) — use it literally
- Month names in English: January, February, ..., December
- Multi-line descriptions use literal newlines inside the string
- For events without alarm, omit the alarm line and \`set evtN to\` (use \`make new event\` directly)
- The user is based in Oslo (CEST/CET). Default timezone is Oslo unless otherwise stated.
- Default date is the date provided in the user message as TODAY

## Output format
Return ONLY a single bash code block with the complete osascript command. No explanation, no preamble, no text after.`;

export async function generateCalendarScript(
  userText: string,
  imageDataUrl: string | null,
  today: string,
): Promise<{ success: boolean; script: string; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { success: false, script: "", error: "ANTHROPIC_API_KEY is not set" };
  }

  type ContentBlock =
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

  const userContent: ContentBlock[] = [];

  if (imageDataUrl) {
    const [header, data] = imageDataUrl.split(",");
    const mediaType = header.replace("data:", "").replace(";base64", "");
    userContent.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data },
    });
  }

  userContent.push({
    type: "text",
    text: `TODAY is ${today}.\n\n${userText || "(no additional text — please create events from the image above)"}`,
  });

  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => String(res.status));
    return { success: false, script: "", error: `Anthropic API error (${res.status}): ${err}` };
  }

  const json = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  const text = json.content?.find((b) => b.type === "text")?.text ?? "";

  // Extract the bash/shell code block from the response
  const match = text.match(/```(?:bash|sh|applescript|shell)?\n([\s\S]*?)```/);
  const script = match ? match[1].trim() : text.trim();

  return { success: true, script };
}
