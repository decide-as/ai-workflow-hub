import { useEffect, useState } from "react";
import {
  X,
  Play,
  FolderInput,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { Workflow, RunResult } from "../../../../shared/types";
import { resolveIcon } from "../lib/icons";

// Per-option UI state, keyed by the option's `key`.
export type OptionValues = Record<string, { enabled: boolean; value: number }>;

// The script prints "Dest directory   : <path>" — pull it out so "Open in
// Finder" reveals exactly where the files landed. Falls back to the source
// folder, which contains the destination subfolder anyway.
function destFromOutput(output: string, fallback: string): string {
  const m = output.match(/^Dest directory\s*:\s*(.+)$/m);
  return m ? m[1].trim() : fallback;
}

export type RunPhase =
  | "configure"
  | "running"
  | "preview"
  | "applying"
  | "done";

export interface RunState {
  workflow: Workflow;
  folder: string;
  phase: RunPhase;
  result: RunResult | null;
  applied: boolean;
  options: OptionValues;
}

interface Props {
  state: RunState;
  onApply: () => void;
  onReveal: (target: string) => void;
  onOptionsChange: (next: OptionValues) => void;
  onConfigure: (options: OptionValues) => void;
  onClose: () => void;
}

function Spinner() {
  return (
    <span
      className="w-3 h-3 rounded-full animate-spin"
      style={{
        border: "1px solid var(--c-border)",
        borderTopColor: "var(--c-text-muted)",
      }}
    />
  );
}

export function RunModal({
  state,
  onApply,
  onReveal,
  onOptionsChange,
  onConfigure,
  onClose,
}: Props) {
  const { workflow, folder, phase, result, applied } = state;
  const Icon = resolveIcon(workflow.icon, workflow.tags);
  const busy = phase === "running" || phase === "applying";

  const [optValues, setOptValues] = useState<OptionValues>(state.options);
  const runnerOptions = workflow.runner?.options ?? [];

  // onOptionsChange is kept for future use (e.g. re-running preview from summary pill).
  void onOptionsChange;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy && phase !== "configure") onClose();
      if (e.key === "Escape" && phase === "configure") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, phase, onClose]);

  const phaseLabel =
    phase === "running"
      ? "Scanning folder…"
      : phase === "preview"
        ? result?.success
          ? "Preview — nothing moved yet"
          : "Could not preview"
        : phase === "applying"
          ? "Applying…"
          : applied
            ? "Done — files moved"
            : "Closed";

  const failed = result != null && !result.success;

  // ── Configure phase ────────────────────────────────────────────────────────
  if (phase === "configure") {
    const ageOpt = runnerOptions.find((o) => o.key === "min_age_days");
    const ageVal = optValues["min_age_days"];
    const sliderMax = 90;
    const days = ageVal ? ageVal.value : 0;
    const everything = !ageVal?.enabled || days === 0;

    function setDays(n: number) {
      if (!ageVal) return;
      setOptValues((prev) => ({
        ...prev,
        min_age_days: { enabled: n > 0, value: n },
      }));
    }

    function ageLabel(n: number) {
      if (n === 0) return "Everything — no age filter";
      if (n === 1) return "Files older than 1 day";
      return `Files older than ${n} days`;
    }

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        onClick={onClose}
      >
        <div className="modal-overlay absolute inset-0" />
        <div
          className="modal-panel relative z-10 w-full max-w-lg mx-6 animate-slide-up flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="h-px w-full rounded-t-[18px] shrink-0"
            style={{
              background: `linear-gradient(90deg, transparent, ${workflow.color}99, transparent)`,
            }}
          />

          {/* Header */}
          <div className="flex items-start gap-4 px-6 pt-5 pb-4">
            <span
              className="w-11 h-11 flex items-center justify-center rounded-xl shrink-0"
              style={{ backgroundColor: `${workflow.color}18` }}
            >
              <Icon
                size={22}
                style={{ color: workflow.color }}
                strokeWidth={1.75}
              />
            </span>
            <div className="flex-1 min-w-0">
              <h2
                className="text-base font-semibold"
                style={{ color: "var(--c-text)" }}
              >
                {workflow.name}
              </h2>
              <div
                className="flex items-center gap-1.5 mt-1 text-[11px]"
                style={{ color: "var(--c-text-muted)" }}
              >
                <FolderInput size={11} className="shrink-0" />
                <span className="truncate font-mono">{folder}</span>
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
              <X size={16} />
            </button>
          </div>

          {/* Slider */}
          {ageOpt && ageVal && (
            <div className="px-6 pb-6 space-y-4">
              <div
                className="rounded-xl border p-4 space-y-4"
                style={{
                  background: "var(--c-surface-inset)",
                  borderColor: "var(--c-border)",
                }}
              >
                <div className="flex items-center justify-between">
                  <p
                    className="text-sm font-medium"
                    style={{ color: "var(--c-text-secondary)" }}
                  >
                    {ageOpt.label}
                  </p>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: everything
                        ? "rgba(169,146,125,0.08)"
                        : `${workflow.color}22`,
                      color: everything
                        ? "var(--c-text-subtle)"
                        : workflow.color,
                    }}
                  >
                    {ageLabel(days)}
                  </span>
                </div>

                <input
                  type="range"
                  min={0}
                  max={sliderMax}
                  step={1}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: workflow.color }}
                />

                <div
                  className="flex justify-between text-[11px]"
                  style={{ color: "var(--c-text-subtle)" }}
                >
                  <span>Everything</span>
                  <span>90 days</span>
                </div>

                {!everything && (
                  <p
                    className="text-[11px] leading-relaxed"
                    style={{ color: "var(--c-text-muted)" }}
                  >
                    Files created or modified within the last {days} day
                    {days !== 1 ? "s" : ""} will be skipped.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div
            className="flex items-center justify-end gap-2 px-6 py-4"
            style={{ borderTop: "1px solid var(--c-border)" }}
          >
            <button onClick={onClose} className="btn btn-sm">
              Cancel
            </button>
            <button
              onClick={() => onConfigure(optValues)}
              className="btn"
              style={{
                backgroundColor: workflow.color,
                color: "var(--c-base)",
                fontSize: "13px",
                fontWeight: 600,
                padding: "8px 16px",
              }}
            >
              <Play size={14} strokeWidth={2.5} />
              Preview
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Running / preview / done phases ───────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={() => !busy && onClose()}
    >
      <div className="modal-overlay absolute inset-0" />

      <div
        className="modal-panel relative z-10 w-full max-w-2xl mx-6 animate-slide-up flex flex-col"
        style={{ maxHeight: "calc(100vh - 80px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="h-px w-full rounded-t-[18px] shrink-0"
          style={{
            background: `linear-gradient(90deg, transparent, ${workflow.color}99, transparent)`,
          }}
        />

        {/* Header */}
        <div className="flex items-start gap-4 px-6 pt-5 pb-4 shrink-0">
          <span
            className="w-11 h-11 flex items-center justify-center rounded-xl shrink-0"
            style={{ backgroundColor: `${workflow.color}18` }}
          >
            <Icon
              size={22}
              style={{ color: workflow.color }}
              strokeWidth={1.75}
            />
          </span>

          <div className="flex-1 min-w-0">
            <h2
              className="text-base font-semibold leading-snug"
              style={{ color: "var(--c-text)" }}
            >
              {workflow.name}
            </h2>
            <div
              className="flex items-center gap-1.5 mt-1 text-[11px] min-w-0"
              style={{ color: "var(--c-text-muted)" }}
            >
              <FolderInput size={11} className="shrink-0" />
              <span className="truncate font-mono">{folder}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={busy}
            className="btn shrink-0 w-8 h-8 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: "var(--c-text-muted)" }}
            onMouseEnter={(e) => {
              if (!busy) {
                e.currentTarget.style.background = "rgba(169,146,125,0.06)";
                e.currentTarget.style.color = "var(--c-text)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--c-text-muted)";
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Phase strip */}
        <div className="px-6 pb-3 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            {busy && <Spinner />}
            {phase === "done" && applied && (
              <CheckCircle2 size={13} className="text-emerald-400" />
            )}
            {failed && <AlertCircle size={13} className="text-red-400" />}
            <span
              style={{
                color: failed ? "rgba(220,100,100,0.9)" : "var(--c-text-muted)",
              }}
            >
              {phaseLabel}
            </span>
          </div>
        </div>

        {/* Age filter pill — reminds user what setting was applied */}
        {(phase === "running" || phase === "preview") &&
          (() => {
            const v = optValues["min_age_days"];
            const days = v?.enabled && v.value > 0 ? v.value : 0;
            return (
              <div className="px-6 pb-3 shrink-0">
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] rounded-full px-2.5 py-1 border"
                  style={{
                    borderColor: "var(--c-border)",
                    color: "var(--c-text-muted)",
                  }}
                >
                  {days === 0
                    ? "All files (no age filter)"
                    : `Files older than ${days} day${days !== 1 ? "s" : ""}`}
                </span>
              </div>
            );
          })()}

        {/* Output */}
        <div className="overflow-y-auto flex-1 px-6 pb-4">
          {result?.output ? (
            <pre className="code-block whitespace-pre-wrap break-words">
              {result.output}
            </pre>
          ) : failed ? (
            <p className="text-sm" style={{ color: "rgba(220,100,100,0.9)" }}>
              {result?.error}
            </p>
          ) : (
            <p className="text-sm" style={{ color: "var(--c-text-muted)" }}>
              Working…
            </p>
          )}
          {failed && result?.output && result?.error && (
            <p
              className="mt-2 text-xs"
              style={{ color: "rgba(220,100,100,0.9)" }}
            >
              {result.error}
            </p>
          )}
        </div>

        {/* Footer actions */}
        <div
          className="flex items-center justify-end gap-2 px-6 py-4 shrink-0"
          style={{ borderTop: "1px solid var(--c-border)" }}
        >
          {phase === "preview" && result?.success && (
            <>
              <button onClick={onClose} className="btn btn-sm">
                Cancel
              </button>
              <button
                onClick={onApply}
                className="btn"
                style={{
                  backgroundColor: workflow.color,
                  color: "var(--c-base)",
                  fontSize: "13px",
                  fontWeight: 600,
                  padding: "8px 16px",
                }}
              >
                <Play size={14} strokeWidth={2.5} />
                Apply moves
              </button>
            </>
          )}

          {phase === "done" && applied && (
            <button
              onClick={() =>
                onReveal(destFromOutput(result?.output ?? "", folder))
              }
              className="btn"
              style={{
                backgroundColor: workflow.color,
                color: "var(--c-base)",
                fontSize: "13px",
                fontWeight: 600,
                padding: "8px 16px",
              }}
            >
              <FolderOpen size={14} strokeWidth={2.5} />
              Open in Finder
            </button>
          )}

          {(phase === "done" || (phase === "preview" && failed)) && (
            <button onClick={onClose} className="btn btn-sm">
              Close
            </button>
          )}

          {busy && (
            <span
              className="inline-flex items-center gap-2 text-sm px-2"
              style={{ color: "var(--c-text-muted)" }}
            >
              <Spinner />
              {phase === "applying" ? "Moving files…" : "Scanning…"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
