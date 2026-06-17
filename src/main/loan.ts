import { shell } from "electron";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { getBaseDir } from "./registry";
import type {
  LoanStakeholder,
  LoanFormData,
  LoanStakeholdersResult,
  LoanGenerateResult,
} from "../../shared/types";

function workflowHubDataDir(): string {
  return join(dirname(getBaseDir()), "workflow-hub-data");
}

export function getLoanStakeholders(): LoanStakeholdersResult {
  try {
    const path = join(
      workflowHubDataDir(),
      "loan-agreement",
      "stakeholders.json",
    );
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw) as { parties: LoanStakeholder[] };
    return { success: true, stakeholders: data.parties };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function fetchSkjermingsrente(): Promise<string> {
  try {
    const res = await fetch(
      "https://www.skatteetaten.no/satser/skjermingsrente/",
    );
    const html = await res.text();
    // The page lists the rate as e.g. "3,25 %" or "3.25 %"
    const m = html.match(/(\d+[.,]\d+)\s*%/);
    if (m) return m[1].replace(".", ",");
  } catch {
    // fall through to default
  }
  return "3,25";
}

function formatNok(amount: number): string {
  return amount
    .toLocaleString("nb-NO", { maximumFractionDigits: 0 })
    .replace(/ /g, " ");
}

function toNorwegianDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function buildHtml(
  giving: LoanStakeholder,
  receiving: LoanStakeholder,
  data: LoanFormData,
  rate: string,
): string {
  const givingRole =
    giving.type === "company" ? `Styreleder, ${giving.name}` : "";
  const receivingRole =
    receiving.type === "company" ? `Styreleder, ${receiving.name}` : "";

  return `<!DOCTYPE html>
<html lang="no">
<head>
<meta charset="UTF-8">
<title>Låneavtale</title>
<style>
  @page { size: A4; margin: 2.5cm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 11pt;
    line-height: 1.65;
    color: #000;
    background: #fff;
    max-width: 760px;
    margin: 0 auto;
    padding: 48px 56px;
  }
  h1 {
    font-size: 14pt;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-bottom: 32px;
  }
  p { margin-bottom: 14px; }
  strong { font-weight: bold; }
  .parties { margin-bottom: 20px; }
  .parties p { margin-bottom: 4px; }
  .signatures {
    display: flex;
    gap: 64px;
    margin-top: 64px;
  }
  .sig { flex: 1; }
  .sig-line {
    border-top: 1px solid #000;
    margin-bottom: 8px;
    margin-top: 48px;
  }
  .sig-name { font-weight: bold; font-size: 10.5pt; }
  .sig-role { font-size: 9.5pt; color: #444; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<h1>Låneavtale</h1>

<p>Denne låneavtalen er inngått mellom:</p>

<div class="parties">
  <p><strong>Utlåner:</strong> ${giving.name}${givingRole ? `, ${givingRole}` : ""}</p>
  <p><strong>Låntaker:</strong> ${receiving.name}${receivingRole ? `, ${receivingRole}` : ""}</p>
</div>

<p><strong>§ 1 Lånebeløp</strong><br>
Utlåner låner herved ut NOK ${formatNok(data.amount)} til låntaker.
Beløpet overføres til låntakers bankkonto ${receiving.account}.</p>

<p><strong>§ 2 Rente</strong><br>
Lånet forrentes med gjeldende skjermingsrente fastsatt av Skatteetaten,
som på avtaletidspunktet er ${rate} %. Renten beregnes og legges til
lånesaldoen løpende i tråd med gjeldende regler.</p>

<p><strong>§ 3 Tilbakebetaling</strong><br>
Lånet med påløpte renter tilbakebetales etter nærmere avtale mellom
partene. Partene kan til enhver tid avtale hel eller delvis
tilbakebetaling uten varsel og uten ekstra kostnader.</p>

<p><strong>§ 4 Mislighold</strong><br>
Ved låntakers konkurs, insolvens eller vesentlig mislighold forfaller
lånet med påløpte renter til øyeblikkelig tilbakebetaling.</p>

<p><strong>§ 5 Lovvalg</strong><br>
Denne avtalen er underlagt norsk rett. Eventuelle tvister søkes løst
i minnelighet, subsidiært ved de ordinære domstoler.</p>

<p>Avtalen er utferdiget i to eksemplarer og signert i
${data.location}, ${toNorwegianDate(data.date)}.</p>

<div class="signatures">
  <div class="sig">
    <div class="sig-line"></div>
    <div class="sig-name">${giving.name}</div>
    ${givingRole ? `<div class="sig-role">${givingRole}</div>` : ""}
  </div>
  <div class="sig">
    <div class="sig-line"></div>
    <div class="sig-name">${receiving.name}</div>
    ${receivingRole ? `<div class="sig-role">${receivingRole}</div>` : ""}
  </div>
</div>
</body>
</html>`;
}

export async function generateLoanAgreement(
  data: LoanFormData,
): Promise<LoanGenerateResult> {
  try {
    const { success, stakeholders, error } = getLoanStakeholders();
    if (!success || !stakeholders)
      return { success: false, error: error ?? "Could not load stakeholders" };

    const giving = stakeholders.find((s) => s.name === data.givingStakeholder);
    const receiving = stakeholders.find(
      (s) => s.name === data.receivingStakeholder,
    );
    if (!giving)
      return {
        success: false,
        error: `Ukjent utlåner: ${data.givingStakeholder}`,
      };
    if (!receiving)
      return {
        success: false,
        error: `Ukjent låntaker: ${data.receivingStakeholder}`,
      };

    const rate = await fetchSkjermingsrente();
    const html = buildHtml(giving, receiving, data, rate);

    const fileName = `låneavtale-${Date.now()}.html`;
    const filePath = join(tmpdir(), fileName);
    writeFileSync(filePath, html, "utf-8");
    await shell.openExternal(`file://${filePath}`);

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
