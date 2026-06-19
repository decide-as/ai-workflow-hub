import { useEffect, useState } from "react";
import { X, FileText, Loader2, Calendar, ChevronDown } from "lucide-react";
import type { LoanStakeholder, Workflow } from "../../../../shared/types";

interface Props {
  workflow: Workflow;
  onClose: () => void;
}

type Phase = "loading" | "form" | "generating" | "done" | "error";

const OTHER = "__other__";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatAccount(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
  }
  return raw;
}

function allowedBorrowersFor(
  lender: LoanStakeholder,
  allBorrowers: LoanStakeholder[],
): LoanStakeholder[] {
  if (!lender.allowedBorrowers?.length) return allBorrowers;
  return allBorrowers.filter((b) => lender.allowedBorrowers!.includes(b.name));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
      <label className="text-[11px]" style={{ color: "var(--c-text-muted)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function LoanModal({ workflow, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [lenders, setLenders] = useState<LoanStakeholder[]>([]);
  const [borrowers, setBorrowers] = useState<LoanStakeholder[]>([]);
  const [giving, setGiving] = useState("");
  const [receiving, setReceiving] = useState("");
  const [customLenderName, setCustomLenderName] = useState("");
  const [customBorrowerName, setCustomBorrowerName] = useState("");
  const [customBorrowerAccount, setCustomBorrowerAccount] = useState("");
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
        const firstLender = result.lenders[0];
        setGiving(firstLender.name);
        const allowed = allowedBorrowersFor(firstLender, result.borrowers);
        setReceiving(allowed[0]?.name ?? "");
        setPhase("form");
      } else {
        setErrorMsg(result.error ?? "Could not load parties");
        setPhase("error");
      }
    });
  }, []);

  async function handleGenerate() {
    if (!canSubmit) return;
    setPhase("generating");
    setErrorMsg("");
    const result = await window.api.loanGenerate({
      givingStakeholder: giving,
      receivingStakeholder: receiving,
      amount: Number(amount),
      date,
      location,
      customGiving:
        giving === OTHER
          ? { name: customLenderName, account: "", type: "person" }
          : undefined,
      customReceiving:
        receiving === OTHER
          ? {
              name: customBorrowerName,
              account: formatAccount(customBorrowerAccount),
              type: "company",
            }
          : undefined,
    });
    if (result.success) {
      setPhase("done");
    } else {
      setErrorMsg(result.error ?? "Ukjent feil");
      setPhase("error");
    }
  }

  const color = workflow.color ?? "#6366f1";
  const selectedLender = lenders.find((l) => l.name === giving);
  const filteredBorrowers = selectedLender
    ? allowedBorrowersFor(selectedLender, borrowers)
    : borrowers;

  const effectiveLenderName = giving === OTHER ? customLenderName : giving;
  const effectiveBorrowerName =
    receiving === OTHER ? customBorrowerName : receiving;
  const sameParty =
    effectiveLenderName !== "" &&
    effectiveLenderName === effectiveBorrowerName;

  const lenderReady = giving !== OTHER || customLenderName.trim() !== "";
  const borrowerReady =
    receiving !== OTHER ||
    (customBorrowerName.trim() !== "" &&
      customBorrowerAccount.replace(/\D/g, "").length === 11);

  const canSubmit =
    phase === "form" &&
    giving &&
    receiving &&
    amount &&
    !sameParty &&
    lenderReady &&
    borrowerReady;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-overlay absolute inset-0" />

      <div
        className="modal-panel relative z-10 w-full max-w-lg mx-6 animate-slide-up flex flex-col"
        style={{ maxHeight: "calc(100vh - 80px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent stripe */}
        <div
          className="h-px w-full rounded-t-[18px] shrink-0"
          style={{
            background: `linear-gradient(90deg, transparent, ${color}99, transparent)`,
          }}
        />

        {/* Header */}
        <div className="flex items-start gap-4 px-6 pt-5 pb-4 shrink-0">
          <span
            className="w-11 h-11 flex items-center justify-center rounded-xl shrink-0"
            style={{ backgroundColor: `${color}18` }}
          >
            <FileText size={22} style={{ color }} strokeWidth={1.75} />
          </span>

          <div className="flex-1 min-w-0">
            <h2
              className="text-[15px] font-semibold leading-snug"
              style={{ color: "var(--c-text)" }}
            >
              New loan agreement
            </h2>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <p
                className="text-[11px] truncate"
                style={{ color: "var(--c-text-muted)" }}
              >
                {workflow.summary ?? workflow.description}
              </p>
              <span
                className="inline-flex items-center gap-1 text-[11px] shrink-0"
                style={{ color: "var(--c-text-subtle)" }}
              >
                <Calendar size={10} />
                Updated {formatDate(workflow.updated)}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn shrink-0 w-8 h-8"
            style={{ color: "var(--c-text-muted)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(169,146,125,0.06)";
              e.currentTarget.style.color = "var(--c-text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--c-text-muted)";
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 pb-6">
          <div className="divider mb-5" />

          {phase === "loading" && (
            <div
              className="flex items-center justify-center gap-2 py-10"
              style={{ color: "var(--c-text-muted)" }}
            >
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading parties…</span>
            </div>
          )}

          {(phase === "form" || (phase === "error" && lenders.length > 0)) && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Field label="Lender">
                    <div className="relative">
                      <select
                        value={giving}
                        onChange={(e) => {
                          const next = lenders.find(
                            (l) => l.name === e.target.value,
                          );
                          setGiving(e.target.value);
                          if (next) {
                            const allowed = allowedBorrowersFor(
                              next,
                              borrowers,
                            );
                            if (!allowed.find((b) => b.name === receiving)) {
                              setReceiving(allowed[0]?.name ?? "");
                            }
                          }
                        }}
                        className="form-input form-select"
                      >
                        {lenders.map((s) => (
                          <option key={s.name} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                        <option value={OTHER}>Other…</option>
                      </select>
                      <ChevronDown
                        size={12}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ color: "var(--c-text-muted)" }}
                      />
                    </div>
                  </Field>
                  {giving === OTHER && (
                    <input
                      type="text"
                      value={customLenderName}
                      onChange={(e) => setCustomLenderName(e.target.value)}
                      placeholder="Full name"
                      className="form-input"
                      autoFocus
                    />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Field label="Borrower">
                    <div className="relative">
                      <select
                        value={receiving}
                        onChange={(e) => setReceiving(e.target.value)}
                        className="form-input form-select"
                      >
                        {filteredBorrowers.map((s) => (
                          <option key={s.name} value={s.name}>
                            {s.type === "company"
                              ? `${s.name} (${formatAccount(s.account)})`
                              : s.name}
                          </option>
                        ))}
                        <option value={OTHER}>Other…</option>
                      </select>
                      <ChevronDown
                        size={12}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ color: "var(--c-text-muted)" }}
                      />
                    </div>
                  </Field>
                  {receiving === OTHER && (
                    <>
                      <input
                        type="text"
                        value={customBorrowerName}
                        onChange={(e) => setCustomBorrowerName(e.target.value)}
                        placeholder="Full name"
                        className="form-input"
                        autoFocus
                      />
                      <input
                        type="text"
                        value={customBorrowerAccount}
                        onChange={(e) =>
                          setCustomBorrowerAccount(e.target.value)
                        }
                        placeholder="xxxx.xx.xxxxx"
                        className="form-input"
                      />
                    </>
                  )}
                </div>
              </div>

              {sameParty && (
                <p
                  className="text-xs px-3 py-2 rounded-lg border"
                  style={{
                    color: "rgba(220,100,100,0.9)",
                    background: "rgba(220,100,100,0.06)",
                    borderColor: "rgba(220,100,100,0.2)",
                  }}
                >
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
                  className="form-input"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Date">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="form-input"
                  />
                </Field>
                <Field label="Location">
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="form-input"
                  />
                </Field>
              </div>

              {phase === "error" && errorMsg && (
                <p
                  className="text-xs px-3 py-2 rounded-lg border"
                  style={{
                    color: "rgba(220,100,100,0.9)",
                    background: "rgba(220,100,100,0.06)",
                    borderColor: "rgba(220,100,100,0.2)",
                  }}
                >
                  {errorMsg}
                </p>
              )}

              <div className="divider" />

              <div className="flex items-center justify-end gap-2">
                <button onClick={onClose} className="btn btn-ghost btn-sm">
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!canSubmit}
                  className="btn btn-sm"
                  style={
                    canSubmit
                      ? {
                          backgroundColor: color,
                          color: "#fff",
                          borderColor: color,
                        }
                      : undefined
                  }
                >
                  <FileText size={12} />
                  Generate →
                </button>
              </div>
            </div>
          )}

          {phase === "generating" && (
            <div
              className="flex flex-col items-center gap-3 py-10"
              style={{ color: "var(--c-text-muted)" }}
            >
              <Loader2 size={24} className="animate-spin" />
              <p className="text-sm">
                Fetching interest rate and generating PDF…
              </p>
            </div>
          )}

          {phase === "done" && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg mb-1"
                style={{
                  background: "rgba(122,158,126,0.12)",
                  border: "1px solid rgba(122,158,126,0.3)",
                  color: "#7a9e7e",
                }}
              >
                ✓
              </div>
              <p
                className="text-sm font-medium"
                style={{ color: "var(--c-text)" }}
              >
                PDF saved and opened in Finder
              </p>
              <p
                className="text-xs mt-1"
                style={{ color: "var(--c-text-subtle)" }}
              >
                Saved to workflow-hub-data/loan-agreement/data/
              </p>
              <div className="mt-4">
                <button onClick={onClose} className="btn btn-ghost btn-sm">
                  Close
                </button>
              </div>
            </div>
          )}

          {phase === "error" && lenders.length === 0 && (
            <p
              className="text-xs px-3 py-2 rounded-lg border"
              style={{
                color: "rgba(220,100,100,0.9)",
                background: "rgba(220,100,100,0.06)",
                borderColor: "rgba(220,100,100,0.2)",
              }}
            >
              {errorMsg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
