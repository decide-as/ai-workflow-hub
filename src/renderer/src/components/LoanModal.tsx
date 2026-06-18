import { useEffect, useState } from "react";
import { X, FileText, Loader2 } from "lucide-react";
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-xs font-medium"
        style={{ color: "var(--c-text-muted)" }}
      >
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

  const effectiveLenderName = giving === OTHER ? customLenderName : giving;
  const effectiveBorrowerName =
    receiving === OTHER ? customBorrowerName : receiving;
  const sameParty =
    effectiveLenderName !== "" && effectiveLenderName === effectiveBorrowerName;

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-overlay absolute inset-0" />
      <div className="modal-panel relative z-10 w-full max-w-lg animate-slide-up flex flex-col">
        {/* Accent stripe */}
        <div
          className="h-px w-full rounded-t-[18px] shrink-0"
          style={{
            background: `linear-gradient(90deg, transparent, ${color}99, transparent)`,
          }}
        />

        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--c-border)" }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}18` }}
          >
            <FileText size={16} style={{ color }} strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <h2
              className="text-sm font-semibold"
              style={{ color: "var(--c-text)" }}
            >
              New loan agreement
            </h2>
            <p
              className="text-xs truncate"
              style={{ color: "var(--c-text-muted)" }}
            >
              {workflow.summary ?? workflow.description}
            </p>
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
        <div className="px-5 py-5 flex flex-col gap-4">
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
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Field label="Lender">
                    <select
                      value={giving}
                      onChange={(e) => setGiving(e.target.value)}
                      className="form-input form-select"
                    >
                      {lenders.map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                      <option value={OTHER}>Other…</option>
                    </select>
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
                    <select
                      value={receiving}
                      onChange={(e) => setReceiving(e.target.value)}
                      className="form-input form-select"
                    >
                      {borrowers.map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.type === "company"
                            ? `${s.name} (${formatAccount(s.account)})`
                            : s.name}
                        </option>
                      ))}
                      <option value={OTHER}>Other…</option>
                    </select>
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
                <p className="error-banner text-xs">
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
                <p className="error-banner text-xs">{errorMsg}</p>
              )}
            </>
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
              <div className="w-10 h-10 rounded-full bg-green-950/60 border border-green-700/40 flex items-center justify-center text-green-400 text-lg mb-1">
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
                style={{ color: "var(--c-text-muted)" }}
              >
                Saved to workflow-hub-data/loan-agreement/data/
              </p>
            </div>
          )}

          {phase === "error" && lenders.length === 0 && (
            <p className="error-banner text-xs">{errorMsg}</p>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3 shrink-0"
          style={{ borderTop: "1px solid var(--c-border)" }}
        >
          {phase === "done" ? (
            <button onClick={onClose} className="btn btn-sm">
              Close
            </button>
          ) : (
            <>
              <button onClick={onClose} className="btn btn-sm">
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={!canSubmit}
                className="btn"
                style={{
                  backgroundColor: canSubmit ? color : undefined,
                  color: canSubmit ? "var(--c-base)" : undefined,
                  fontSize: "12px",
                  fontWeight: 600,
                  padding: "5px 14px",
                  opacity: canSubmit ? 1 : 0.38,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                }}
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
