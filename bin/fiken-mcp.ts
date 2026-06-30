/**
 * Fiken MCP server — exposes purchases read/write to Claude sessions.
 *
 * Reads FIKEN_API_TOKEN and FIKEN_COMPANY_SLUG from environment.
 * Loads .env from the git repo root using the same pattern as src/main/index.ts.
 *
 * All monetary amounts are in øre (1/100 NOK). 1000 NOK = 100000 øre.
 */
import { config as dotenvConfig } from "dotenv";
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { readFileSync } from "fs";
import FormData from "form-data";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

try {
  const raw = execSync("git rev-parse --git-common-dir", {
    encoding: "utf8",
    cwd: dirname(resolve(process.argv[1])),
  }).trim();
  dotenvConfig({ path: resolve(dirname(resolve(raw)), ".env") });
} catch {
  // packaged or outside git — use existing process.env
}

const FIKEN_BASE = "https://api.fiken.no/api/v2";

function token(): string {
  const t = process.env.FIKEN_API_TOKEN;
  if (!t) throw new Error("FIKEN_API_TOKEN is not set in .env");
  return t;
}

function slug(): string {
  const s = process.env.FIKEN_COMPANY_SLUG;
  if (!s) throw new Error("FIKEN_COMPANY_SLUG is not set in .env");
  return s;
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: `Bearer ${token()}`, ...extra };
}

function purchaseWebUrl(purchaseId: number): string {
  return `https://fiken.no/company/${slug()}/purchases/${purchaseId}`;
}

async function fikenGet(path: string): Promise<unknown> {
  const res = await fetch(`${FIKEN_BASE}${path}`, {
    headers: headers({ Accept: "application/json" }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Fiken ${res.status}: ${body}`);
  }
  return res.json();
}

// ── Server ──────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "fiken",
  version: "1.0.0",
});

// ── Tool: list_purchases ─────────────────────────────────────────────────────

server.tool(
  "list_purchases",
  "List purchases from Fiken. Use this to study past purchases and understand account codes and VAT patterns used in this company's bookkeeping.",
  {
    page: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe("0-indexed page number (default 0)"),
    page_size: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(25)
      .describe("Results per page, max 100 (default 25)"),
    date_from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Filter from date, YYYY-MM-DD (inclusive)"),
    date_to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Filter to date, YYYY-MM-DD (inclusive)"),
    sort_by: z
      .enum(["date asc", "date desc"])
      .default("date desc")
      .describe("Sort order"),
  },
  async ({ page, page_size, date_from, date_to, sort_by }) => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(page_size),
      sortBy: sort_by,
    });
    if (date_from) params.set("date", date_from);
    if (date_to) params.append("date", date_to);
    const data = await fikenGet(`/companies/${slug()}/purchases?${params}`);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    };
  },
);

// ── Tool: get_purchase ───────────────────────────────────────────────────────

server.tool(
  "get_purchase",
  "Get a single purchase by ID from Fiken. Use this to inspect the full detail of a past purchase including all line items and account codes.",
  {
    purchase_id: z.number().int().positive().describe("Fiken purchase ID"),
  },
  async ({ purchase_id }) => {
    const data = await fikenGet(
      `/companies/${slug()}/purchases/${purchase_id}`,
    );
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    };
  },
);

// ── Tool: create_purchase ────────────────────────────────────────────────────

const PurchaseLineSchema = z.object({
  description: z.string().describe("Line item description"),
  net_price_cents: z
    .number()
    .int()
    .describe("Net price in øre (1/100 NOK). Example: 1000 NOK = 100000"),
  vat_type: z
    .enum(["HIGH", "MEDIUM", "LOW", "NONE", "EXEMPT"])
    .describe(
      "VAT type: HIGH=25% (standard), MEDIUM=15% (food), LOW=12% (transport/hotel), NONE=0%",
    ),
  account: z
    .string()
    .describe(
      "Norwegian chart-of-accounts code. Examples: 7140 (travel), 7130 (accommodation), 6900 (misc outlay), 1500 (loan receivable)",
    ),
});

server.tool(
  "create_purchase",
  "Create a new purchase entry in Fiken. Returns the purchase ID and a URL to view it in the Fiken web app. Study past purchases with list_purchases/get_purchase first to ensure consistent account codes.",
  {
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .describe("Transaction date, YYYY-MM-DD"),
    kind: z
      .enum(["cash_purchase", "credit_purchase"])
      .describe(
        "cash_purchase = paid immediately; credit_purchase = payable to supplier",
      ),
    description: z
      .string()
      .describe("Purchase description / identifier shown in Fiken"),
    currency: z
      .string()
      .default("NOK")
      .describe("ISO currency code, default NOK"),
    paid: z.boolean().describe("Whether the purchase has been paid"),
    payment_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Payment date, YYYY-MM-DD — required when paid=true"),
    payment_account: z
      .string()
      .optional()
      .describe(
        'Fiken account reference in format "accountCode:bankAccountId" (e.g. "1920:10001"). Required when paid=true. Get the bankAccountId from Fiken settings.',
      ),
    lines: z
      .array(PurchaseLineSchema)
      .min(1)
      .describe("Line items for the purchase"),
  },
  async ({
    date,
    kind,
    description,
    currency,
    paid,
    payment_date,
    payment_account,
    lines,
  }) => {
    const body: Record<string, unknown> = {
      date,
      kind,
      description,
      currency,
      paid,
      lines: lines.map((l) => ({
        description: l.description,
        netPrice: l.net_price_cents,
        vatType: l.vat_type,
        incomeAccount: l.account,
      })),
    };
    if (paid && payment_date) body.paymentDate = payment_date;
    if (paid && payment_account) body.paymentAccount = payment_account;

    const res = await fetch(`${FIKEN_BASE}/companies/${slug()}/purchases`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Fiken ${res.status}: ${text}`);
    }

    // Fiken returns the new purchase URL in the Location header
    const location = res.headers.get("location") ?? "";
    const purchaseIdMatch = location.match(/\/purchases\/(\d+)/);
    const purchaseId = purchaseIdMatch ? Number(purchaseIdMatch[1]) : null;

    const result = {
      purchaseId,
      webUrl: purchaseId ? purchaseWebUrl(purchaseId) : null,
      apiUrl: location || null,
    };
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(result, null, 2) },
      ],
    };
  },
);

// ── Tool: add_purchase_attachment ────────────────────────────────────────────

server.tool(
  "add_purchase_attachment",
  "Attach a file (receipt, PDF) to an existing Fiken purchase. The file_path must be an absolute path on the local filesystem.",
  {
    purchase_id: z
      .number()
      .int()
      .positive()
      .describe("Fiken purchase ID to attach to"),
    file_path: z
      .string()
      .describe(
        "Absolute path to the file to attach (receipt, Excel, PDF, image)",
      ),
    filename: z
      .string()
      .optional()
      .describe(
        "Override filename shown in Fiken (defaults to the actual file name)",
      ),
    description: z
      .string()
      .optional()
      .describe("Optional description for the attachment"),
  },
  async ({ purchase_id, file_path, filename, description }) => {
    const fileBuffer = readFileSync(file_path);
    const effectiveName =
      filename ?? file_path.split("/").pop() ?? "attachment";

    const form = new FormData();
    form.append("file", fileBuffer, {
      filename: effectiveName,
    });
    if (description) form.append("description", description);

    const res = await fetch(
      `${FIKEN_BASE}/companies/${slug()}/purchases/${purchase_id}/attachments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token()}`,
          ...form.getHeaders(),
        },
        body: form.getBuffer(),
      },
    );

    if (!res.ok && res.status !== 201) {
      const text = await res.text();
      throw new Error(`Fiken ${res.status}: ${text}`);
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            purchaseId: purchase_id,
            attachedFile: effectiveName,
          }),
        },
      ],
    };
  },
);

// ── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
