import { spawnSync } from "child_process";
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { VoucherFolderResult } from "../../shared/types";

// The real claude binary — the shell wrapper in ~/.zshrc is a function and
// not available to Node's spawnSync, so we target the binary directly.
const CLAUDE_BIN = "/Users/christianbraathen/.local/bin/claude";

const SYSTEM_INSTRUCTION = `Returner KUN declare -a TRANSAKSJONER=(...) blokken, ingen annen tekst, ingen forklaring, ingen kodeblokk-markers.`;

const CLAUDE_PROMPT = (filePaths: string[]) =>
  `${filePaths.map((p) => `Les bildet på filstien: ${p}`).join("\n")}

Operativsystem: Mac
Se på bildene ovenfor og lag meg en terminalkommando som lager en mappe for hver av disse transaksjonene i pwd. Det må være mulig å kjøre koden rett inn i en zsh-terminal uten å mellomlagre som et script først.

- Mappenavnet for kjøp skal være "YYYY-MM-DD <LEVERANDØR>", der du må fylle inn leverandøren og datoen. Du må hente ut leverandøren fra linjebeskrivelsen. Hvis du er usikker, la det stå LEVERANDØR
- Mappenavnet for internoverføring skal være "YYYY-MM-DD OVERFØRING"
- Mappenavnet for innbetalinger skal være "YYYY-MM-DD <KUNDE>, INN", der du må fylle inn kundenavnet og datoen.

- Hvis en mappe eksisterer med dette navnet allerede for en OVERFØRING, skal du hoppe over å lage en ny mappe.
- Hvis vi har en ikke-overføring (kostnad eller inntekt) med samme dato og aktør, skal du lage en mappe men legge på en "#<nummer>" bak. For eksempel for to Domeneshop-transaksjoner som normalt sett ville blitt kalt "2025-09-22 Domeneshop AS", skal vi istedenfor få: "2025-09-22 Domeneshop AS #1" og "2025-09-22 Domeneshop AS #2". Dette er ekstremt viktig å få til, ellers kommer vi ikke til å få flere mapper.

Flere instruksjoner om mappenavn:
- Ikke ta med firmatypen (AS, Inc, etc)
- "Bankgebyr" skal få navnet "SR-Bank" istedenfor.
- Ha alt i Title Case.
- Sas Vostokinc skal ha "ScrapingBee" istedenfor.
- "OPENAI *CHATGPT ..."  skal ha "OpenAI" istedenfor

${SYSTEM_INSTRUCTION}`;

// The folder-creation script. TRANSAKSJONER_PLACEHOLDER is substituted at runtime.
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

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const [header, data] = dataUrl.split(",");
  if (!header || !data) return null;
  return Buffer.from(data, "base64");
}

function extFromMediaType(dataUrl: string): string {
  const header = dataUrl.split(",")[0] ?? "";
  if (header.includes("jpeg") || header.includes("jpg")) return ".jpg";
  if (header.includes("png")) return ".png";
  if (header.includes("gif")) return ".gif";
  if (header.includes("webp")) return ".webp";
  if (header.includes("pdf")) return ".pdf";
  return ".bin";
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

  if (!existsSync(CLAUDE_BIN)) {
    return {
      success: false,
      output: "",
      folders: [],
      error: `claude binary not found at ${CLAUDE_BIN}`,
    };
  }

  // Write image files to a temp directory so claude can read them
  let tmpDir: string;
  try {
    tmpDir = mkdtempSync(join(tmpdir(), "voucher-"));
  } catch (err) {
    return {
      success: false,
      output: "",
      folders: [],
      error: `Could not create temp directory: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const filePaths: string[] = [];
  try {
    for (const file of files) {
      const buf = dataUrlToBuffer(file.dataUrl);
      if (!buf) continue;
      const ext = extFromMediaType(file.dataUrl);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const dest = join(tmpDir, safeName.endsWith(ext) ? safeName : safeName + ext);
      writeFileSync(dest, buf);
      filePaths.push(dest);
    }
  } catch (err) {
    return {
      success: false,
      output: "",
      folders: [],
      error: `Could not write temp files: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (filePaths.length === 0) {
    return {
      success: false,
      output: "",
      folders: [],
      error: "No valid image files to process",
    };
  }

  const prompt = CLAUDE_PROMPT(filePaths);

  const claudeResult = spawnSync(
    CLAUDE_BIN,
    ["-p", prompt, "--allowedTools", "Read", "--add-dir", tmpDir],
    { encoding: "utf8", timeout: 120_000 },
  );

  // Clean up temp files regardless of outcome
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // Non-fatal — OS will clean up eventually
  }

  if (claudeResult.error) {
    return {
      success: false,
      output: "",
      folders: [],
      error: `claude process error: ${claudeResult.error.message}`,
    };
  }

  const claudeText = claudeResult.stdout ?? "";

  if (claudeResult.status !== 0) {
    return {
      success: false,
      output: claudeText,
      folders: [],
      error:
        claudeResult.stderr?.trim() ||
        `claude exited with code ${claudeResult.status}`,
    };
  }

  const entries = parseTransaksjoner(claudeText);
  if (!entries) {
    return {
      success: false,
      output: claudeText,
      folders: [],
      error:
        "Could not parse TRANSAKSJONER array from Claude's response. Raw output saved.",
    };
  }

  const script = buildScript(entries);

  const shellResult = spawnSync("zsh", ["-c", script], {
    encoding: "utf8",
    cwd: outputDir,
  });

  if (shellResult.error) {
    return {
      success: false,
      output: "",
      folders: [],
      error: `Shell error: ${shellResult.error.message}`,
    };
  }

  const stdout = shellResult.stdout ?? "";
  const stderr = shellResult.stderr ?? "";
  const output = stderr ? `${stdout}\n${stderr}`.trim() : stdout.trim();

  const createdFolders = stdout
    .split("\n")
    .filter((l) => l.startsWith("created: "))
    .map((l) => l.slice("created: ".length).trim());

  if (shellResult.status !== 0) {
    return {
      success: false,
      output,
      folders: createdFolders,
      error: stderr.trim() || `Script exited with code ${shellResult.status}`,
    };
  }

  return { success: true, output, folders: createdFolders };
}
