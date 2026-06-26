import { useState, useEffect, useRef } from "react";
import {
  FolderOpen,
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  Play,
  Eye,
} from "lucide-react";
import type {
  OrganizerPlan,
  OrganizerProgress,
} from "../../../../shared/types";

type Phase =
  | "idle"
  | "scanning"
  | "restructure-warning"
  | "confirm"
  | "applying"
  | "done"
  | "error";

export function ImageOrganizerControls() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [dryRun, setDryRun] = useState(false);
  const [progress, setProgress] = useState<OrganizerProgress | null>(null);
  const [plan, setPlan] = useState<OrganizerPlan | null>(null);
  const [result, setResult] = useState<{
    moved: number;
    logPath: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubRef.current = window.api.onOrganizerProgress((p) => setProgress(p));
    return () => unsubRef.current?.();
  }, []);

  async function handlePickAndScan() {
    const folder = await window.api.pickFolder("Choose folder to organize");
    if (!folder) return;

    setPhase("scanning");
    setProgress(null);
    setPlan(null);
    setErrorMsg("");

    try {
      const p = await window.api.organizerScan(folder);
      setPlan(p);

      if (p.restructured.length > 0) {
        setPhase("restructure-warning");
      } else {
        setPhase("confirm");
      }
    } catch (e) {
      setErrorMsg(String(e));
      setPhase("error");
    }
  }

  async function handleApply(confirmedDryRun: boolean) {
    if (!plan) return;
    setPhase("applying");
    try {
      const r = await window.api.organizerApply(plan, confirmedDryRun);
      setResult({ moved: r.moved, logPath: r.logPath });
      setPhase("done");
    } catch (e) {
      setErrorMsg(String(e));
      setPhase("error");
    }
  }

  function reset(e: React.MouseEvent) {
    e.stopPropagation();
    setPhase("idle");
    setPlan(null);
    setProgress(null);
    setResult(null);
    setErrorMsg("");
  }

  function revealLog(e: React.MouseEvent) {
    e.stopPropagation();
    if (result?.logPath) window.api.revealPath(result.logPath);
  }

  // — scanning —
  if (phase === "scanning") {
    const label = progress
      ? progress.phase === "clustering"
        ? "Clustering…"
        : `Analyzing ${progress.current}/${progress.total}: ${progress.currentFile}`
      : "Starting…";
    return (
      <div
        className="flex items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <Loader2
          size={11}
          className="animate-spin shrink-0"
          style={{ color: "var(--c-text-muted)" }}
        />
        <span
          className="text-[11px] truncate"
          style={{ color: "var(--c-text-muted)" }}
        >
          {label}
        </span>
      </div>
    );
  }

  // — restructure warning —
  if (phase === "restructure-warning" && plan) {
    return (
      <div
        className="flex items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <AlertTriangle size={11} className="shrink-0 text-amber-400" />
        <span className="text-[11px] text-amber-400 flex-1 truncate">
          {plan.restructured.length} files would move clusters
        </span>
        <button
          onClick={() => setPhase("confirm")}
          className="btn btn-sm shrink-0"
        >
          Review
        </button>
        <button
          onClick={reset}
          className="btn btn-sm w-7 h-7 p-0 shrink-0"
          title="Cancel"
        >
          <XCircle size={11} />
        </button>
      </div>
    );
  }

  // — confirm plan —
  if (phase === "confirm" && plan) {
    return (
      <div
        className="flex items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className="text-[11px] flex-1 truncate"
          style={{ color: "var(--c-text-muted)" }}
        >
          {plan.moves.length} files → {plan.clusters.length} folders
          {plan.miscCount > 0 ? ` + ${plan.miscCount} misc` : ""}
        </span>
        <button
          onClick={() => handleApply(true)}
          className="btn btn-sm shrink-0"
          title="Dry run — log only, no moves"
        >
          <Eye size={11} />
          Preview
        </button>
        <button
          onClick={() => handleApply(false)}
          className="btn btn-sm shrink-0"
          title="Move files now"
        >
          <Play size={11} />
          Move
        </button>
      </div>
    );
  }

  // — applying —
  if (phase === "applying") {
    return (
      <div
        className="flex items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <Loader2
          size={11}
          className="animate-spin shrink-0"
          style={{ color: "var(--c-text-muted)" }}
        />
        <span className="text-[11px]" style={{ color: "var(--c-text-muted)" }}>
          {dryRun ? "Logging plan…" : "Moving files…"}
        </span>
      </div>
    );
  }

  // — done —
  if (phase === "done" && result) {
    return (
      <div
        className="flex items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <CheckCircle2 size={11} className="shrink-0 text-emerald-400" />
        <span className="text-[11px] text-emerald-400 flex-1 truncate">
          {result.moved} files {dryRun ? "logged" : "moved"}
        </span>
        <button onClick={revealLog} className="btn btn-sm shrink-0">
          <FolderOpen size={11} />
          Log
        </button>
        <button
          onClick={reset}
          className="btn btn-sm w-7 h-7 p-0 shrink-0"
          title="Run again"
        >
          <RotateCcw size={11} />
        </button>
      </div>
    );
  }

  // — error —
  if (phase === "error") {
    return (
      <div
        className="flex items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <XCircle size={11} className="shrink-0 text-red-400" />
        <span className="text-[11px] text-red-400 flex-1 truncate">
          {errorMsg}
        </span>
        <button onClick={reset} className="btn btn-sm shrink-0">
          <RotateCcw size={11} />
          Retry
        </button>
      </div>
    );
  }

  // — idle —
  return (
    <div
      className="flex items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <label
        className="flex items-center gap-1 cursor-pointer shrink-0"
        title="Dry run — log only"
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={dryRun}
          onChange={(e) => setDryRun(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
        />
        <span
          className={[
            "text-[10px] px-1.5 py-0.5 rounded border transition-colors",
            dryRun
              ? "border-amber-500/60 text-amber-400 bg-amber-500/10"
              : "border-zinc-700 text-zinc-500",
          ].join(" ")}
        >
          Dry run
        </span>
      </label>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handlePickAndScan();
        }}
        className="btn btn-sm flex-1"
      >
        <FolderOpen size={11} />
        Pick folder
      </button>
    </div>
  );
}
