import { useEffect, useState } from "react";
import {
  X,
  TrendingUp,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Check,
} from "lucide-react";
import type {
  LoanStakeholder,
  LoanTransaction,
  LoanInterestPeriod,
  Workflow,
} from "../../../../shared/types";

interface Props {
  workflow: Workflow;
  onClose: () => void;
}

type Phase = "loading" | "managing" | "calculating" | "result" | "error";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function allowedBorrowersFor(
  lender: LoanStakeholder,
  allBorrowers: LoanStakeholder[],
): LoanStakeholder[] {
  if (!lender.allowedBorrowers?.length) return allBorrowers;
  return allBorrowers.filter((b) => lender.allowedBorrowers!.includes(b.name));
}

function fmt(n: number): string {
  return n.toLocaleString("nb-NO", { maximumFractionDigits: 0 });
}

function fmtInterest(n: number): string {
  return n.toLocaleString("nb-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const SELECT_CLS =
  "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors";
const INPUT_CLS =
  "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors";
const BTN_GHOST =
  "px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors";
const BTN_ICON =
  "p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors";

interface TxFormState {
  date: string;
  type: "loan" | "repayment";
  amount: string;
}

function emptyForm(): TxFormState {
  return { date: todayIso(), type: "loan", amount: "" };
}

function TxTypeTag({ type }: { type: "loan" | "repayment" }) {
  return type === "loan" ? (
    <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-900/60 text-indigo-300 border border-indigo-700/40">
      Lån
    </span>
  ) : (
    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-900/60 text-green-300 border border-green-700/40">
      Nedbetaling
    </span>
  );
}

export function LoanInterestModal({ workflow, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [lenders, setLenders] = useState<LoanStakeholder[]>([]);
  const [borrowers, setBorrowers] = useState<LoanStakeholder[]>([]);
  const [giving, setGiving] = useState("");
  const [receiving, setReceiving] = useState("");

  const [transactions, setTransactions] = useState<LoanTransaction[]>([]);
  const [toDate, setToDate] = useState(todayIso());

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TxFormState>(emptyForm());
  const [addingNew, setAddingNew] = useState(false);
  const [addForm, setAddForm] = useState<TxFormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [periods, setPeriods] = useState<LoanInterestPeriod[]>([]);
  const [totalInterest, setTotalInterest] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Load stakeholders
  useEffect(() => {
    window.api.loanGetStakeholders().then((result) => {
      if (
        result.success &&
        result.lenders?.length &&
        result.borrowers?.length
      ) {
        setLenders(result.lenders);
        setBorrowers(result.borrowers);
        const firstLender = result.lenders[0];
        setGiving(firstLender.name);
        const allowed = allowedBorrowersFor(firstLender, result.borrowers);
        setReceiving(allowed[0]?.name ?? "");
        setPhase("managing");
      } else {
        setErrorMsg(result.error ?? "Could not load stakeholders");
        setPhase("error");
      }
    });
  }, []);

  // Load transactions when pair changes
  useEffect(() => {
    if (!giving || !receiving || phase === "loading" || phase === "error")
      return;
    setPhase("managing");
    setPeriods([]);
    setEditingId(null);
    setAddingNew(false);
    window.api.loanInterestGetTransactions(giving, receiving).then((result) => {
      if (result.success) {
        setTransactions(result.transactions ?? []);
      } else {
        setErrorMsg(result.error ?? "Could not load transactions");
      }
    });
  }, [giving, receiving]);

  async function handleSaveEdit(tx: LoanTransaction) {
    setSaving(true);
    const result = await window.api.loanInterestSaveTransaction({
      id: tx.id,
      lender: giving,
      borrower: receiving,
      date: editForm.date,
      type: editForm.type,
      amount: Number(editForm.amount),
    });
    setSaving(false);
    if (result.success && result.transaction) {
      setTransactions((prev) =>
        prev.map((t) => (t.id === tx.id ? result.transaction! : t)),
      );
      setEditingId(null);
    } else {
      setErrorMsg(result.error ?? "Could not save");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this transaction?")) return;
    const result = await window.api.loanInterestDeleteTransaction(id);
    if (result.success) {
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } else {
      setErrorMsg(result.error ?? "Could not delete");
    }
  }

  async function handleAdd() {
    if (!addForm.date || !addForm.amount) return;
    setSaving(true);
    const result = await window.api.loanInterestSaveTransaction({
      lender: giving,
      borrower: receiving,
      date: addForm.date,
      type: addForm.type,
      amount: Number(addForm.amount),
    });
    setSaving(false);
    if (result.success && result.transaction) {
      setTransactions((prev) =>
        [...prev, result.transaction!].sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
      );
      setAddingNew(false);
      setAddForm(emptyForm());
    } else {
      setErrorMsg(result.error ?? "Could not add");
    }
  }

  async function handleCalculate() {
    setPhase("calculating");
    setErrorMsg("");
    const result = await window.api.loanInterestCalculate(
      giving,
      receiving,
      toDate,
    );
    if (result.success && result.periods) {
      setPeriods(result.periods);
      setTotalInterest(result.totalInterest ?? 0);
      setPhase("result");
    } else {
      setErrorMsg(result.error ?? "Calculation failed");
      setPhase("managing");
    }
  }

  const color = workflow.color ?? "#6366f1";
  const selectedLender = lenders.find((l) => l.name === giving);
  const filteredBorrowers = selectedLender
    ? allowedBorrowersFor(selectedLender, borrowers)
    : borrowers;

  const canCalculate =
    phase === "managing" &&
    transactions.length > 0 &&
    toDate > (transactions[0]?.date ?? "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-lg bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800 shrink-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}22` }}
          >
            <TrendingUp size={16} style={{ color }} strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-zinc-100">
              Accrued Loan Interest
            </h2>
            <p className="text-xs text-zinc-500 truncate">
              {workflow.summary ?? workflow.description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 flex flex-col gap-4 overflow-y-auto">
          {phase === "loading" && (
            <div className="flex items-center justify-center gap-2 py-10 text-zinc-500">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          )}

          {(phase === "managing" ||
            phase === "calculating" ||
            phase === "result") && (
            <>
              {/* Pair selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-400">
                    Lender
                  </label>
                  <select
                    value={giving}
                    onChange={(e) => {
                      const next = lenders.find(
                        (l) => l.name === e.target.value,
                      );
                      setGiving(e.target.value);
                      if (next) {
                        const allowed = allowedBorrowersFor(next, borrowers);
                        if (!allowed.find((b) => b.name === receiving)) {
                          setReceiving(allowed[0]?.name ?? "");
                        }
                      }
                    }}
                    className={SELECT_CLS}
                    disabled={phase === "calculating"}
                  >
                    {lenders.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-400">
                    Borrower
                  </label>
                  <select
                    value={receiving}
                    onChange={(e) => setReceiving(e.target.value)}
                    className={SELECT_CLS}
                    disabled={phase === "calculating"}
                  >
                    {filteredBorrowers.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Transactions list */}
              {phase !== "result" && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Transactions
                    </span>
                  </div>

                  {transactions.length === 0 && !addingNew && (
                    <p className="text-xs text-zinc-600 py-2">
                      No transactions yet — add one below.
                    </p>
                  )}

                  {transactions.length > 0 && (
                    <div className="rounded-lg border border-zinc-800 overflow-hidden">
                      {transactions.map((tx) => (
                        <div key={tx.id}>
                          {editingId === tx.id ? (
                            // Inline edit form
                            <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/60 border-b border-zinc-700/50 last:border-b-0">
                              <input
                                type="date"
                                value={editForm.date}
                                onChange={(e) =>
                                  setEditForm((f) => ({
                                    ...f,
                                    date: e.target.value,
                                  }))
                                }
                                className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none w-28"
                              />
                              <select
                                value={editForm.type}
                                onChange={(e) =>
                                  setEditForm((f) => ({
                                    ...f,
                                    type: e.target.value as
                                      "loan" | "repayment",
                                  }))
                                }
                                className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none"
                              >
                                <option value="loan">Lån</option>
                                <option value="repayment">Nedbetaling</option>
                              </select>
                              <input
                                type="number"
                                min="1"
                                value={editForm.amount}
                                onChange={(e) =>
                                  setEditForm((f) => ({
                                    ...f,
                                    amount: e.target.value,
                                  }))
                                }
                                className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none w-28"
                              />
                              <button
                                onClick={() => handleSaveEdit(tx)}
                                disabled={saving || !editForm.amount}
                                className="p-1 rounded text-green-400 hover:bg-zinc-700 disabled:opacity-40"
                              >
                                <Check size={13} />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className={BTN_ICON}
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            // Normal row
                            <div className="flex items-center gap-3 px-3 py-2 border-b border-zinc-800/60 last:border-b-0 hover:bg-zinc-800/30 transition-colors">
                              <span className="text-xs text-zinc-400 w-20 shrink-0">
                                {tx.date}
                              </span>
                              <TxTypeTag type={tx.type} />
                              <span className="text-xs text-zinc-200 flex-1 text-right">
                                {fmt(tx.amount)} kr
                              </span>
                              <button
                                onClick={() => {
                                  setEditingId(tx.id);
                                  setEditForm({
                                    date: tx.date,
                                    type: tx.type,
                                    amount: String(tx.amount),
                                  });
                                  setAddingNew(false);
                                }}
                                className={BTN_ICON}
                                title="Edit"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={() => handleDelete(tx.id)}
                                className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add form */}
                  {addingNew ? (
                    <div className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 bg-zinc-800/40">
                      <input
                        type="date"
                        value={addForm.date}
                        onChange={(e) =>
                          setAddForm((f) => ({ ...f, date: e.target.value }))
                        }
                        className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none w-28"
                      />
                      <select
                        value={addForm.type}
                        onChange={(e) =>
                          setAddForm((f) => ({
                            ...f,
                            type: e.target.value as "loan" | "repayment",
                          }))
                        }
                        className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none"
                      >
                        <option value="loan">Lån</option>
                        <option value="repayment">Nedbetaling</option>
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={addForm.amount}
                        onChange={(e) =>
                          setAddForm((f) => ({ ...f, amount: e.target.value }))
                        }
                        placeholder="Amount"
                        className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none w-28 placeholder:text-zinc-600"
                      />
                      <button
                        onClick={handleAdd}
                        disabled={saving || !addForm.amount}
                        className="p-1 rounded text-green-400 hover:bg-zinc-700 disabled:opacity-40"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        onClick={() => setAddingNew(false)}
                        className={BTN_ICON}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setAddingNew(true);
                        setAddForm(emptyForm());
                        setEditingId(null);
                      }}
                      className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors self-start py-1"
                    >
                      <Plus size={12} />
                      Add transaction
                    </button>
                  )}
                </div>
              )}

              {/* Calculate to date */}
              {phase !== "result" && (
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-xs font-medium text-zinc-400">
                      Calculate to
                    </label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className={INPUT_CLS}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 justify-end pt-5">
                    <button
                      onClick={handleCalculate}
                      disabled={!canCalculate || phase === "calculating"}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                      style={{
                        backgroundColor: canCalculate ? color : undefined,
                      }}
                    >
                      {phase === "calculating" ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <TrendingUp size={12} />
                      )}
                      Calculate →
                    </button>
                  </div>
                </div>
              )}

              {/* Error inline */}
              {errorMsg && phase !== "result" && (
                <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
                  {errorMsg}
                </p>
              )}

              {/* Result table */}
              {phase === "result" && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Interest breakdown
                    </span>
                    <span className="text-xs text-zinc-500">
                      {giving} → {receiving}
                    </span>
                  </div>
                  <div className="rounded-lg border border-zinc-800 overflow-hidden">
                    {/* Header */}
                    <div className="grid grid-cols-5 gap-0 px-3 py-2 bg-zinc-800/60 border-b border-zinc-700">
                      {["Period", "Rate", "Balance", "Days", "Interest"].map(
                        (h) => (
                          <span
                            key={h}
                            className="text-xs font-medium text-zinc-400"
                          >
                            {h}
                          </span>
                        ),
                      )}
                    </div>
                    {periods.map((p, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-5 gap-0 px-3 py-2 border-b border-zinc-800/50 last:border-b-0 hover:bg-zinc-800/20"
                      >
                        <span className="text-xs text-zinc-200">{p.label}</span>
                        <span className="text-xs text-zinc-400">
                          {p.rate.toLocaleString("nb-NO", {
                            minimumFractionDigits: 1,
                          })}{" "}
                          %
                        </span>
                        <span className="text-xs text-zinc-300">
                          {fmt(p.balance)}
                        </span>
                        <span className="text-xs text-zinc-400">{p.days}</span>
                        <span className="text-xs text-zinc-200">
                          {fmtInterest(p.interest)}
                        </span>
                      </div>
                    ))}
                    {/* Total row */}
                    <div className="grid grid-cols-5 gap-0 px-3 py-2 bg-zinc-800/40 border-t border-zinc-700">
                      <span className="col-span-4 text-xs font-semibold text-zinc-200">
                        Total accrued interest
                      </span>
                      <span className="text-xs font-semibold text-zinc-100">
                        {fmtInterest(totalInterest)} kr
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-600">
                    Calculated to {toDate} using skjermingsrente from
                    skatteetaten.no
                  </p>
                </div>
              )}
            </>
          )}

          {phase === "error" && lenders.length === 0 && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-800 shrink-0">
          {phase === "result" ? (
            <>
              <button
                onClick={() => {
                  setPhase("managing");
                  setPeriods([]);
                  setErrorMsg("");
                }}
                className={BTN_GHOST}
              >
                ← New calculation
              </button>
              <button onClick={onClose} className={BTN_GHOST}>
                Close
              </button>
            </>
          ) : (
            <button onClick={onClose} className={BTN_GHOST}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
