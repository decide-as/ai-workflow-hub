import { spawnSync } from "child_process";
import { existsSync } from "fs";
import type { VoucherFolderResult } from "../../shared/types";

const CLAUDE_PROMPT = `Operativsystem: Mac
Se på bildet nedenfor og lag meg en terminalkommando som lager en mappe for hver av disse transaksjonene i pwd. Det må være mulig å kjøre koden rett inn i en zsh-terminal uten å mellomlagre som et script først.

- Mappenavnet for kjøp skal være "YYYY-MM-DD <LEVERANDØR>", der du må fylle inn leverandøren og datoen. Du må hente ut leverandøren fra linjebeskrivelsen. Hvis du er usikker, la det stå LEVERANDØR
- Mappenavnet for internoverføring skal være "YYYY-MM-DD OVERFØRING"
- Mappenavnet for innbetalinger skal være "YYYY-MM-DD <KUNDE>, INN", der du må fylle inn kundenavnet og datoen.

- Hvis en mappe eksisterer med dette navnet allerede for en OVERFØRING, skal du hoppe over å lage en ny mappe.
- Hvis vi har en ikke-overføring (kostnad eller inntekt) med samme dato og aktør, skal du lage en mappe hvor transaksjon men legge på en "#<nummer>" bak. For eksempel for to Domeneshop-transaksjoner som normalt sett ville blitt kalt "2025-09-22 Domeneshop AS", skal vi istedenfor få: "2025-09-22 Domeneshop AS #1" og ""2025-09-22 Domeneshop AS #2". Dette er ekstremt viktig å få til, ellers kommer vi ikke til å få flere mapper.

Flere instruksjoner om mappenavn:
- Ikke ta med firmatypen (AS, Inc, etc)
- "Bankgebyr" skal få navnet "SR-Bank" istedenfor.
- Ha alt i Title Case.
- Sas Vostokinc skal ha "ScrapingBee" istedenfor.
- "OPENAI *CHATGPT ..."  skal ha "OpenAI" istedenfor

Returner KUN declare -a TRANSAKSJONER=(...) blokken, ingen annen tekst, ingen forklaring, ingen kodeblokk-markers.`;

// The folder-creation script logic. TRANSAKSJONER_PLACEHOLDER is replaced at
// runtime with the array content extracted from Claude's response.
const FOLDER_SCRIPT_TEMPLATE = `#!/bin/zsh

declare -a TRANSAKSJONER=(
TRANSAKSJONER_PLACEHOLDER
)

normalize_name() {
  echo "$1" \\
  | sed -E 's/\\b(AS|A\\/S|INC|CO|COMPANY|LLC|LTD|GROUP)\\b//Ig' \\
  | sed -E 's/ +/ /g' \\
  | sed -E 's/^ *| *$//g' \\
  | sed -E 's/\\bBankgebyr\\b/SR-Bank/Ig' \\
  | sed -E 's/\\bSas Vostokinc\\b/ScrapingBee/Ig' \\
  | awk '{for (i=1;i<=NF;i++) {$i=toupper(substr($i,1,1)) substr($i,2)}}1'
}

for entry in "\${TRANSAKSJONER[@]}"; do
  base_name=$(normalize_name "$entry")

  if [ -d "$base_name" ]; then
    if [[ "$base_name" == *"OVERFØRING"* ]]; then
      echo "skip: $base_name"
      continue
    fi
    i=2
    while [ -d "$base_name #$i" ]; do
      ((i++))
    done
    name="$base_name #$i"
  else
    name="$base_name"
  fi

  mkdir "$name"
  echo "created: $name"
done`;

function parseTransaksjoner(claudeResponse: string): string[] | null {
  // Try to extract the quoted strings inside declare -a TRANSAKSJONER=(...)
  const arrayMatch = claudeResponse.match(
    /declare\s+-a\s+TRANSAKSJONER=\(\s*([\s\S]*?)\s*\)/,
  );
  if (!arrayMatch) return null;

  const inner = arrayMatch[1];
  const entries: string[] = [];
  const lineRe = /"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(inner)) !== null) {
    entries.push(m[1]);
  }
  return entries.length > 0 ? entries : null;
}

function buildScript(entries: string[]): string {
  const placeholder = entries.map((e) => `"${e}"`).join("\n");
  return FOLDER_SCRIPT_TEMPLATE.replace("TRANSAKSJONER_PLACEHOLDER", placeholder);
}

export async function createVoucherFolders(
  files: Array<{ name: string; dataUrl: string }>,
  outputDir: string,
): Promise<VoucherFolderResult> {
  if (!existsSync(outputDir)) {
    return {
      success: false,
      output: "",
      folders: [],
      error: `Output directory does not exist: ${outputDir}`,
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      output: "",
      folders: [],
      error: "ANTHROPIC_API_KEY is not set",
    };
  }

  type ContentBlock =
    | { type: "text"; text: string }
    | {
        type: "image";
        source: { type: "base64"; media_type: string; data: string };
      };

  const userContent: ContentBlock[] = [];

  for (const file of files) {
    const [header, data] = file.dataUrl.split(",");
    if (!header || !data) continue;
    const mediaType = header.replace("data:", "").replace(";base64", "");
    if (!mediaType.startsWith("image/") && mediaType !== "application/pdf") {
      continue;
    }
    userContent.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data },
    });
  }

  if (userContent.length === 0) {
    return {
      success: false,
      output: "",
      folders: [],
      error: "No valid image files found in the dropped files",
    };
  }

  userContent.push({ type: "text", text: CLAUDE_PROMPT });

  const body = {
    model: "claude-opus-4-8",
    max_tokens: 4096,
    messages: [{ role: "user", content: userContent }],
  };

  let claudeText: string;
  try {
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
      return {
        success: false,
        output: "",
        folders: [],
        error: `Anthropic API error (${res.status}): ${err}`,
      };
    }

    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    claudeText = json.content?.find((b) => b.type === "text")?.text ?? "";
  } catch (err) {
    return {
      success: false,
      output: "",
      folders: [],
      error: `Network error calling Anthropic API: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const entries = parseTransaksjoner(claudeText);
  if (!entries) {
    return {
      success: false,
      output: claudeText,
      folders: [],
      error:
        "Could not parse TRANSAKSJONER array from Claude's response. Raw response saved to output.",
    };
  }

  const script = buildScript(entries);

  const result = spawnSync("zsh", ["-c", script], {
    encoding: "utf8",
    cwd: outputDir,
  });

  if (result.error) {
    return {
      success: false,
      output: "",
      folders: [],
      error: `Shell error: ${result.error.message}`,
    };
  }

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const output = stderr ? `${stdout}\n${stderr}`.trim() : stdout.trim();

  const createdFolders = stdout
    .split("\n")
    .filter((l) => l.startsWith("created: "))
    .map((l) => l.slice("created: ".length).trim());

  if (result.status !== 0) {
    return {
      success: false,
      output,
      folders: createdFolders,
      error: stderr.trim() || `Script exited with code ${result.status}`,
    };
  }

  return { success: true, output, folders: createdFolders };
}
