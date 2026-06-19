import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { randomUUID } from "crypto";
import { getBaseDir } from "./registry";
import type {
  LoanTransaction,
  LoanTransactionsResult,
  LoanTransactionSaveResult,
  LoanTransactionDeleteResult,
  LoanInterestPeriod,
  LoanInterestResult,
} from "../../shared/types";

function dataDir(): string {
  return join(dirname(getBaseDir()), "workflow-hub-data", "loan-interest");
}

function txPath(): string {
  return join(dataDir(), "transactions.json");
}

function readAll(): LoanTransaction[] {
  try {
    return JSON.parse(readFileSync(txPath(), "utf-8")) as LoanTransaction[];
  } catch {
    return [];
  }
}

function writeAll(txs: LoanTransaction[]): void {
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(txPath(), JSON.stringify(txs, null, 2), "utf-8");
}

export function getTransactions(
  lender: string,
  borrower: string,
): LoanTransactionsResult {
  try {
    const all = readAll();
    const filtered = all
      .filter((t) => t.lender === lender && t.borrower === borrower)
      .sort((a, b) => a.date.localeCompare(b.date));
    return { success: true, transactions: filtered };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export function saveTransaction(
  tx: Omit<LoanTransaction, "id"> & { id?: string },
): LoanTransactionSaveResult {
  try {
    const all = readAll();
    if (tx.id) {
      const idx = all.findIndex((t) => t.id === tx.id);
      if (idx === -1) return { success: false, error: "Transaction not found" };
      const updated: LoanTransaction = { ...tx, id: tx.id };
      all[idx] = updated;
      writeAll(all);
      return { success: true, transaction: updated };
    } else {
      const newTx: LoanTransaction = { ...tx, id: randomUUID() };
      all.push(newTx);
      writeAll(all);
      return { success: true, transaction: newTx };
    }
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export function deleteTransaction(id: string): LoanTransactionDeleteResult {
  try {
    const all = readAll();
    const next = all.filter((t) => t.id !== id);
    if (next.length === all.length)
      return { success: false, error: "Transaction not found" };
    writeAll(next);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── Skjermingsrente fetching ──────────────────────────────────────────────────

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

// bimonthIdx → rate (%)
type YearRates = Map<number, number>;
const rateCache = new Map<number, YearRates>();

async function fetchYearRates(year: number): Promise<YearRates> {
  if (rateCache.has(year)) return rateCache.get(year)!;

  const res = await fetch(
    `https://www.skatteetaten.no/satser/skjermingsrente-for-ekstra-skatt-pa-lan?year=${year}#rateShowYear`,
  );
  if (!res.ok)
    throw new Error(
      `Skatteetaten svarte med ${res.status} — kan ikke hente skjermingsrente for ${year}`,
    );

  const html = await res.text();
  const rowRe =
    /<tr[^>]*>\s*<td[^>]*>([\wæøåÆØÅ\s]+?)<\/td>\s*<td[^>]*>(.*?)<\/td>/gi;
  const result: YearRates = new Map();

  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const period = m[1].trim().toLowerCase();
    const cell = m[2].replace(/&nbsp;/g, "").trim();
    const words = period.split(/\s+/);
    const startMonth = NORWEGIAN_MONTHS[words[0]];
    const endMonth = NORWEGIAN_MONTHS[words[2]];
    if (!startMonth || !endMonth) continue;
    const rateMatch = cell.match(/(\d+[.,]\d+)/);
    if (!rateMatch) continue;
    const rate = parseFloat(rateMatch[1].replace(",", "."));
    const idx = Math.floor((startMonth - 1) / 2);
    result.set(idx, rate);
  }

  rateCache.set(year, result);
  return result;
}

const BIMONTH_LABELS = [
  "Jan–Feb",
  "Mar–Apr",
  "Mai–Jun",
  "Jul–Aug",
  "Sep–Okt",
  "Nov–Des",
];

function bimonthIdx(month: number): number {
  return Math.floor((month - 1) / 2);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function toNorwegianDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

// ── Interest calculation ──────────────────────────────────────────────────────
//
// Each loan tranche carries the skjermingsrente that was in effect on the day
// the loan was made. That rate is frozen for the life of the tranche — it does
// NOT change when the bimonthly rate changes. Repayments reduce the oldest
// tranche first (FIFO). Breakpoints are only transaction dates + toDate.

type Tranche = { amount: number; rate: number };

export async function calculateInterest(
  lender: string,
  borrower: string,
  toDate: string,
): Promise<LoanInterestResult> {
  try {
    const { success, transactions, error } = getTransactions(lender, borrower);
    if (!success || !transactions)
      return { success: false, error: error ?? "Could not load transactions" };
    if (transactions.length === 0)
      return { success: false, error: "Ingen transaksjoner registrert" };

    const firstDate = transactions[0].date;
    if (toDate <= firstDate)
      return {
        success: false,
        error: "Sluttdato må være etter første transaksjon",
      };

    // Pre-fetch rates for all years that contain loan transactions —
    // we only need rates on the day each tranche is created.
    const loanYears = new Set<number>(
      transactions
        .filter((t) => t.type === "loan")
        .map((t) => parseInt(t.date.slice(0, 4), 10)),
    );
    const yearRatesMap = new Map<number, YearRates>();
    for (const yr of loanYears) {
      yearRatesMap.set(yr, await fetchYearRates(yr));
    }

    function rateForDate(iso: string): number {
      const year = parseInt(iso.slice(0, 4), 10);
      const month = parseInt(iso.slice(5, 7), 10);
      const idx = bimonthIdx(month);
      const rate = yearRatesMap.get(year)?.get(idx);
      if (rate === undefined) {
        const label = `${BIMONTH_LABELS[idx]} ${year}`;
        throw new Error(
          `Skjermingsrenten for ${label} er ikke publisert ennå — sjekk skatteetaten.no`,
        );
      }
      return rate;
    }

    // Breakpoints: transaction dates + toDate (no bimonth boundaries — each
    // tranche's rate is frozen, so period splits don't change anything).
    const breakpointSet = new Set<string>();
    breakpointSet.add(firstDate);
    breakpointSet.add(toDate);
    for (const tx of transactions) {
      if (tx.date > firstDate && tx.date < toDate) breakpointSet.add(tx.date);
    }
    const breakpoints = Array.from(breakpointSet).sort();

    const tranches: Tranche[] = [];
    let txIdx = 0;
    const periods: LoanInterestPeriod[] = [];

    for (let i = 0; i < breakpoints.length - 1; i++) {
      const segStart = breakpoints[i];
      const segEnd = breakpoints[i + 1];

      // Apply all transactions that fall on segStart
      while (
        txIdx < transactions.length &&
        transactions[txIdx].date === segStart
      ) {
        const tx = transactions[txIdx];
        if (tx.type === "loan") {
          // Lock in the rate at the time this tranche is created
          tranches.push({ amount: tx.amount, rate: rateForDate(tx.date) });
        } else {
          // FIFO repayment: reduce oldest tranches first
          let remaining = tx.amount;
          while (remaining > 0 && tranches.length > 0) {
            if (tranches[0].amount <= remaining) {
              remaining -= tranches[0].amount;
              tranches.shift();
            } else {
              tranches[0].amount -= remaining;
              remaining = 0;
            }
          }
        }
        txIdx++;
      }

      const balance = tranches.reduce((s, t) => s + t.amount, 0);
      if (balance <= 0) continue;

      const days = daysBetween(new Date(segStart), new Date(segEnd));
      if (days <= 0) continue;

      // Each tranche accrues at its own locked-in rate
      const interest = tranches.reduce(
        (s, t) => s + (t.amount * (t.rate / 100) * days) / 365,
        0,
      );
      // Weighted average rate for display only
      const avgRate =
        tranches.reduce((s, t) => s + t.amount * t.rate, 0) / balance;

      const label = `${toNorwegianDate(segStart)} – ${toNorwegianDate(segEnd)}`;
      periods.push({ label, rate: avgRate, balance, days, interest });
    }

    const totalInterest = periods.reduce((s, p) => s + p.interest, 0);
    return { success: true, periods, totalInterest };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
