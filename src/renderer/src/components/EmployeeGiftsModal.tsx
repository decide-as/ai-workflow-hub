import { useEffect, useState } from "react";
import {
  X,
  Gift,
  Calendar,
  ChevronDown,
  AlertTriangle,
  Printer,
} from "lucide-react";
import type { Workflow } from "../../../../shared/types";
import {
  calculateGiftTax,
  type GiftCalculation,
  ANNUAL_GIFT_LIMIT_NOK,
} from "../../../../shared/gift-tax";

interface Props {
  workflow: Workflow;
  onClose: () => void;
}

type Phase = "form" | "confirm" | "result";

const OTHER = "__other__";
const KNOWN_EMPLOYEES = ["Christian Braathen"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatNok(n: number): string {
  return n.toLocaleString("nb-NO") + " kr";
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <label className="text-[11px]" style={{ color: "var(--c-text-muted)" }}>
          {label}
        </label>
        {hint && (
          <span
            className="text-[10px]"
            style={{ color: "var(--c-text-subtle)" }}
          >
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function ResultRow({
  label,
  value,
  highlight,
  warn,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2 rounded-lg"
      style={{
        background: warn
          ? "rgba(220,100,100,0.06)"
          : highlight
            ? "rgba(122,158,126,0.08)"
            : "var(--c-surface-raised)",
        border: warn
          ? "1px solid rgba(220,100,100,0.2)"
          : highlight
            ? "1px solid rgba(122,158,126,0.2)"
            : "1px solid var(--c-border)",
      }}
    >
      <span className="text-[12px]" style={{ color: "var(--c-text-muted)" }}>
        {label}
      </span>
      <span
        className="text-[13px] font-medium tabular-nums"
        style={{
          color: warn
            ? "rgba(220,100,100,0.9)"
            : highlight
              ? "#7a9e7e"
              : "var(--c-text)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function EmployeeGiftsModal({ workflow, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("form");
  const [employee, setEmployee] = useState(KNOWN_EMPLOYEES[0]);
  const [customEmployee, setCustomEmployee] = useState("");
  const [giftAmount, setGiftAmount] = useState("");
  const [previousTotal, setPreviousTotal] = useState("");
  const [giftDate, setGiftDate] = useState(todayIso());
  const [result, setResult] = useState<GiftCalculation | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const effectiveEmployee =
    employee === OTHER ? customEmployee.trim() : employee;

  const parsedGift = Number(giftAmount);
  const parsedPrev = previousTotal.trim() === "" ? 0 : Number(previousTotal);

  const canSubmit =
    effectiveEmployee !== "" &&
    giftAmount !== "" &&
    !isNaN(parsedGift) &&
    parsedGift > 0 &&
    !isNaN(parsedPrev) &&
    parsedPrev >= 0;

  function handleCalculate() {
    if (!canSubmit) return;
    const prevIsZeroAndUnconfirmed =
      parsedPrev === 0 && previousTotal.trim() === "";
    if (prevIsZeroAndUnconfirmed) {
      setPhase("confirm");
      return;
    }
    runCalculation(parsedPrev);
  }

  function handleConfirm() {
    runCalculation(0);
  }

  function runCalculation(prev: number) {
    setResult(calculateGiftTax(prev, parsedGift));
    setPhase("result");
  }

  function handleReset() {
    setPhase("form");
    setResult(null);
    setGiftAmount("");
    setPreviousTotal("");
    setGiftDate(todayIso());
  }

  const color = workflow.color ?? "#6366f1";

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
            <Gift size={22} style={{ color }} strokeWidth={1.75} />
          </span>

          <div className="flex-1 min-w-0">
            <h2
              className="text-[15px] font-semibold leading-snug"
              style={{ color: "var(--c-text)" }}
            >
              Register employee gift
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

          {/* ── Form phase ─────────────────────────────────────────── */}
          {phase === "form" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <Field label="Employee">
                  <div className="relative">
                    <select
                      value={employee}
                      onChange={(e) => setEmployee(e.target.value)}
                      className="form-input form-select"
                    >
                      {KNOWN_EMPLOYEES.map((name) => (
                        <option key={name} value={name}>
                          {name}
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
                {employee === OTHER && (
                  <input
                    type="text"
                    value={customEmployee}
                    onChange={(e) => setCustomEmployee(e.target.value)}
                    placeholder="Full name"
                    className="form-input"
                    autoFocus
                  />
                )}
              </div>

              <Field label="Gift amount (NOK)">
                <input
                  type="number"
                  min="1"
                  value={giftAmount}
                  onChange={(e) => setGiftAmount(e.target.value)}
                  placeholder="e.g. 3 000"
                  className="form-input"
                />
              </Field>

              <Field
                label="Previous gifts this year (NOK)"
                hint="— leave blank if this is the first gift"
              >
                <input
                  type="number"
                  min="0"
                  value={previousTotal}
                  onChange={(e) => setPreviousTotal(e.target.value)}
                  placeholder="0"
                  className="form-input"
                />
              </Field>

              <Field label="Gift date">
                <input
                  type="date"
                  value={giftDate}
                  onChange={(e) => setGiftDate(e.target.value)}
                  className="form-input"
                />
              </Field>

              <div
                className="text-[11px] px-3 py-2 rounded-lg"
                style={{
                  color: "var(--c-text-subtle)",
                  background: "var(--c-surface-raised)",
                  border: "1px solid var(--c-border)",
                }}
              >
                Norwegian rule: gifts up to{" "}
                <strong>{formatNok(ANNUAL_GIFT_LIMIT_NOK)}</strong> per employee
                per calendar year are tax-free. Any amount above the annual
                aggregate must be reported as income.
              </div>

              <div className="divider" />

              <div className="flex items-center justify-end gap-2">
                <button onClick={onClose} className="btn btn-ghost btn-sm">
                  Cancel
                </button>
                <button
                  onClick={handleCalculate}
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
                  <Gift size={12} />
                  Calculate →
                </button>
              </div>
            </div>
          )}

          {/* ── Confirm phase (no previous gifts entered) ──────────── */}
          {phase === "confirm" && (
            <div className="space-y-4">
              <div
                className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{
                  background: "rgba(234,179,8,0.06)",
                  border: "1px solid rgba(234,179,8,0.2)",
                }}
              >
                <AlertTriangle
                  size={16}
                  className="shrink-0 mt-0.5"
                  style={{ color: "rgba(234,179,8,0.85)" }}
                />
                <div className="space-y-1">
                  <p
                    className="text-[13px] font-medium"
                    style={{ color: "var(--c-text)" }}
                  >
                    No previous gifts provided
                  </p>
                  <p
                    className="text-[12px] leading-relaxed"
                    style={{ color: "var(--c-text-muted)" }}
                  >
                    You have not entered any previous gifts for{" "}
                    <strong>{effectiveEmployee}</strong> this year. Please
                    confirm that this is the first gift of the calendar year —
                    if you have a previous gift document, go back and enter the
                    total from it.
                  </p>
                </div>
              </div>

              <div className="divider" />

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setPhase("form")}
                  className="btn btn-ghost btn-sm"
                >
                  Go back
                </button>
                <button
                  onClick={handleConfirm}
                  className="btn btn-sm"
                  style={{
                    backgroundColor: color,
                    color: "#fff",
                    borderColor: color,
                  }}
                >
                  Yes, first gift of the year
                </button>
              </div>
            </div>
          )}

          {/* ── Result phase ────────────────────────────────────────── */}
          {phase === "result" && result && (
            <div className="space-y-4">
              <div
                className="text-[11px] px-3 py-2 rounded-lg"
                style={{
                  color: "var(--c-text-subtle)",
                  background: "var(--c-surface-raised)",
                  border: "1px solid var(--c-border)",
                }}
              >
                <span
                  className="font-medium"
                  style={{ color: "var(--c-text)" }}
                >
                  {effectiveEmployee}
                </span>{" "}
                — {formatDate(giftDate)}
              </div>

              <div className="space-y-2">
                <ResultRow
                  label="This gift (NOK)"
                  value={formatNok(result.giftAmount)}
                />
                <ResultRow
                  label="Previous gifts this year (NOK)"
                  value={formatNok(result.previousTotal)}
                />
                <div className="divider" />
                <ResultRow
                  label="Tax-free portion of this gift"
                  value={formatNok(result.taxFreeThisGift)}
                  highlight={result.taxFreeThisGift > 0}
                />
                <ResultRow
                  label="Taxable as income (report to employer)"
                  value={formatNok(result.taxableThisGift)}
                  warn={result.taxableThisGift > 0}
                />
                <div className="divider" />
                <ResultRow
                  label="Total given this calendar year"
                  value={formatNok(result.totalGiven)}
                />
                <ResultRow
                  label={`Remaining tax-free allowance (of ${formatNok(ANNUAL_GIFT_LIMIT_NOK)})`}
                  value={formatNok(result.remainingAllowance)}
                  highlight={result.remainingAllowance > 0}
                  warn={result.remainingAllowance === 0}
                />
              </div>

              {result.taxableThisGift > 0 && (
                <div
                  className="flex items-start gap-3 px-4 py-3 rounded-xl text-[12px]"
                  style={{
                    background: "rgba(220,100,100,0.06)",
                    border: "1px solid rgba(220,100,100,0.2)",
                    color: "rgba(220,100,100,0.9)",
                  }}
                >
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>
                    {formatNok(result.taxableThisGift)} must be reported as
                    taxable income for {effectiveEmployee} and processed through
                    payroll.
                  </span>
                </div>
              )}

              <div className="divider" />

              <div className="flex items-center justify-end gap-2">
                <button onClick={handleReset} className="btn btn-ghost btn-sm">
                  New entry
                </button>
                <button
                  onClick={() => window.print()}
                  className="btn btn-ghost btn-sm"
                >
                  <Printer size={12} />
                  Print
                </button>
                <button onClick={onClose} className="btn btn-sm">
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
