/**
 * Fiken API client for use in the Electron main process.
 * Used by the loan agreement IPC handler to post transactions directly.
 *
 * Reads FIKEN_API_TOKEN and FIKEN_COMPANY_SLUG from process.env
 * (already loaded from .env by src/main/index.ts on startup).
 *
 * All monetary amounts are in øre (1/100 NOK). 1000 NOK = 100000 øre.
 */

import type { FikenCreatePurchaseArgs, FikenCreateResult } from "../../shared/types";

const FIKEN_BASE = "https://api.fiken.no/api/v2";

function getToken(): string {
  const t = process.env.FIKEN_API_TOKEN;
  if (!t) throw new Error("FIKEN_API_TOKEN is not set — add it to .env");
  return t;
}

function getSlug(): string {
  const s = process.env.FIKEN_COMPANY_SLUG;
  if (!s) throw new Error("FIKEN_COMPANY_SLUG is not set — add it to .env");
  return s;
}

function purchaseWebUrl(purchaseId: number): string {
  return `https://fiken.no/company/${getSlug()}/purchases/${purchaseId}`;
}

export async function createPurchase(
  args: FikenCreatePurchaseArgs,
): Promise<FikenCreateResult> {
  try {
    const token = getToken();
    const slug = getSlug();

    const body: Record<string, unknown> = {
      date: args.date,
      kind: args.kind,
      description: args.description,
      currency: args.currency ?? "NOK",
      paid: args.paid,
      lines: args.lines.map((l) => ({
        description: l.description,
        netPrice: l.netPriceCents,
        vatType: l.vatType,
        incomeAccount: l.account,
      })),
    };
    if (args.paid && args.paymentDate) body.paymentDate = args.paymentDate;
    if (args.paid && args.paymentAccount) body.paymentAccount = args.paymentAccount;

    const res = await fetch(`${FIKEN_BASE}/companies/${slug}/purchases`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Fiken ${res.status}: ${text}` };
    }

    const location = res.headers.get("location") ?? "";
    const match = location.match(/\/purchases\/(\d+)/);
    const purchaseId = match ? Number(match[1]) : undefined;

    return {
      success: true,
      purchaseId,
      webUrl: purchaseId ? purchaseWebUrl(purchaseId) : undefined,
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
