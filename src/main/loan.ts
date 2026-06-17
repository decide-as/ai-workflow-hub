import { shell, BrowserWindow } from "electron";
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
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
    const data = JSON.parse(raw) as {
      lenders: LoanStakeholder[];
      borrowers: LoanStakeholder[];
    };
    return { success: true, lenders: data.lenders, borrowers: data.borrowers };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

const NORWEGIAN_MONTHS: Record<string, number> = {
  januar: 1,
  februar: 2,
  mars: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  desember: 12,
};

async function fetchSkjermingsrente(date: string): Promise<string> {
  const year = date.slice(0, 4);
  const month = parseInt(date.slice(5, 7), 10);

  const res = await fetch(
    `https://www.skatteetaten.no/satser/skjermingsrente-for-ekstra-skatt-pa-lan?year=${year}#rateShowYear`,
  );
  if (!res.ok)
    throw new Error(
      `Skatteetaten svarte med ${res.status} — kan ikke hente skjermingsrente`,
    );

  const html = await res.text();

  // Each row: <td>Januar og februar 2026</td><td>3,4 %</td>
  const rowRe =
    /<tr[^>]*>\s*<td[^>]*>([\wæøåÆØÅ\s]+?)<\/td>\s*<td[^>]*>(.*?)<\/td>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const period = m[1].trim().toLowerCase();
    const cell = m[2].replace(/&nbsp;/g, "").trim();

    // "januar og februar 2026" → words[0]=start month, words[2]=end month
    const words = period.split(/\s+/);
    const startMonth = NORWEGIAN_MONTHS[words[0]];
    const endMonth = NORWEGIAN_MONTHS[words[2]];
    if (!startMonth || !endMonth) continue;

    if (month >= startMonth && month <= endMonth) {
      const rateMatch = cell.match(/(\d+[.,]\d+)/);
      if (!rateMatch)
        throw new Error(
          `Skjermingsrenten for ${m[1].trim()} er ikke publisert ennå — sjekk skatteetaten.no`,
        );
      return rateMatch[1].replace(".", ",");
    }
  }

  throw new Error(
    `Fant ikke skjermingsrente for ${date} på skatteetaten.no — sjekk siden manuelt`,
  );
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

async function htmlToPdf(html: string, outputPath: string): Promise<void> {
  const tmpHtml = join(tmpdir(), `loan-tmp-${Date.now()}.html`);
  writeFileSync(tmpHtml, html, "utf-8");

  const win = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  try {
    await win.loadFile(tmpHtml);
    const pdfBuffer = await win.webContents.printToPDF({
      pageSize: "A4",
      printBackground: false,
      margins: { marginType: "none" },
    });
    writeFileSync(outputPath, pdfBuffer);
  } finally {
    win.destroy();
    try {
      unlinkSync(tmpHtml);
    } catch {}
  }
}

export async function generateLoanAgreement(
  data: LoanFormData,
): Promise<LoanGenerateResult> {
  try {
    const { success, lenders, borrowers, error } = getLoanStakeholders();
    if (!success || !lenders || !borrowers)
      return { success: false, error: error ?? "Could not load stakeholders" };

    const giving = lenders.find((s) => s.name === data.givingStakeholder);
    const receiving = borrowers.find(
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

    const rate = await fetchSkjermingsrente(data.date);
    const html = buildHtml(giving, receiving, data, rate);

    const outDir = join(workflowHubDataDir(), "loan-agreement", "data");
    mkdirSync(outDir, { recursive: true });

    const slug = (s: string) => s.replace(/\s+/g, "-");
    const fileName = `låneavtale-${data.date}-${slug(giving.name)}-til-${slug(receiving.name)}.pdf`;
    const pdfPath = join(outDir, fileName);

    await htmlToPdf(html, pdfPath);
    shell.showItemInFolder(pdfPath);

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
