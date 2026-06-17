import { useEffect, useState } from "react";
import { X, FileText, Loader2 } from "lucide-react";
import type { LoanStakeholder, Workflow } from "../../../../shared/types";

interface Props {
  workflow: Workflow;
  onClose: () => void;
}

type Phase = "loading" | "form" | "generating" | "done" | "error";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-zinc-400">{label}</label>
      {children}
    </div>
  );
}

const SELECT_CLS =
  "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors";
const INPUT_CLS =
  "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors";

export function LoanModal({ workflow, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [lenders, setLenders] = useState<LoanStakeholder[]>([]);
  const [borrowers, setBorrowers] = useState<LoanStakeholder[]>([]);
  const [giving, setGiving] = useState("");
  const [receiving, setReceiving] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [location, setLocation] = useState("Oslo");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    window.api.loanGetStakeholders().then((result) => {
      if (
        result.success &&
        result.lenders?.length &&
        result.borrowers?.length
      ) {
        setLenders(result.lenders);
        setBorrowers(result.borrowers);
        setGiving(result.lenders[0].name);
        setReceiving(result.borrowers[0].name);
        setPhase("form");
      } else {
        setErrorMsg(result.error ?? "Could not load parties");
        setPhase("error");
      }
    });
  }, []);

  async function handleGenerate() {
    if (!giving || !receiving || !amount || giving === receiving) return;
    setPhase("generating");
    setErrorMsg("");
    const result = await window.api.loanGenerate({
      givingStakeholder: giving,
      receivingStakeholder: receiving,
      amount: Number(amount),
      date,
      location,
    });
    if (result.success) {
      setPhase("done");
    } else {
      setErrorMsg(result.error ?? "Ukjent feil");
      setPhase("error");
    }
  }

  const color = workflow.color ?? "#6366f1";
  const sameParty = giving !== "" && giving === receiving;
  const canSubmit =
    phase === "form" && giving && receiving && amount && !sameParty;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-lg bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800 shrink-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}22` }}
          >
            <FileText size={16} style={{ color }} strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-zinc-100">
              New loan agreement
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
        <div className="px-5 py-5 flex flex-col gap-4">
          {phase === "loading" && (
            <div className="flex items-center justify-center gap-2 py-10 text-zinc-500">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading parties…</span>
            </div>
          )}

          {(phase === "form" || (phase === "error" && lenders.length > 0)) && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Lender">
                  <select
                    value={giving}
                    onChange={(e) => setGiving(e.target.value)}
                    className={SELECT_CLS}
                  >
                    {lenders.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Borrower">
                  <select
                    value={receiving}
                    onChange={(e) => setReceiving(e.target.value)}
                    className={SELECT_CLS}
                  >
                    {borrowers.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.type === "company"
                          ? `${s.name} (${s.account})`
                          : s.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {sameParty && (
                <p className="text-xs text-red-400 bg-red-950/30 border border-red-700/30 rounded-lg px-3 py-2">
                  Lender and borrower cannot be the same party.
                </p>
              )}

              <Field label="Amount (NOK)">
                <input
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="500 000"
                  className={INPUT_CLS}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Date">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={INPUT_CLS}
                  />
                </Field>
                <Field label="Location">
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className={INPUT_CLS}
                  />
                </Field>
              </div>

              {phase === "error" && errorMsg && (
                <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
                  {errorMsg}
                </p>
              )}
            </>
          )}

          {phase === "generating" && (
            <div className="flex flex-col items-center gap-3 py-10 text-zinc-400">
              <Loader2 size={24} className="animate-spin text-zinc-500" />
              <p className="text-sm">
                Fetching interest rate and generating PDF…
              </p>
            </div>
          )}

          {phase === "done" && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <div className="w-10 h-10 rounded-full bg-green-950/60 border border-green-700/40 flex items-center justify-center text-green-400 text-lg mb-1">
                ✓
              </div>
              <p className="text-sm font-medium text-zinc-100">
                PDF saved and opened in Finder
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Saved to workflow-hub-data/loan-agreement/data/
              </p>
            </div>
          )}

          {phase === "error" && lenders.length === 0 && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-800 shrink-0">
          {phase === "done" ? (
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              Close
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={!canSubmit}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: canSubmit ? color : undefined }}
              >
                <FileText size={12} />
                Generate →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
