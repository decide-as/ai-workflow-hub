import { useEffect, useState } from "react";
import { Clock, FolderInput, ScrollText } from "lucide-react";
import type { Workflow, ScheduleStatus } from "../../../../shared/types";
import { LogModal } from "./LogModal";

interface Props {
  workflow: Workflow;
}

function formatRun(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SchedulePanel({ workflow }: Props) {
  const job = workflow.scheduled_job;
  const [status, setStatus] = useState<ScheduleStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    let alive = true;
    function refresh() {
      window.api.scheduleStatus(workflow.id).then((s) => {
        if (alive) setStatus(s);
      });
    }
    refresh();
    const timer = setInterval(refresh, 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [workflow.id]);

  if (!job) return null;

  const active = !!status?.loaded;
  const checking = status == null;

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    setBusy(true);
    const next = active
      ? await window.api.scheduleDisable(workflow.id)
      : await window.api.scheduleEnable(workflow.id);
    setStatus(next);
    setBusy(false);
  }

  function openLog(e: React.MouseEvent) {
    e.stopPropagation();
    setShowLog(true);
  }

  return (
    <>
      <div
        className="schedule-panel space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cadence · target */}
        <div
          className="flex items-center gap-1.5 text-xs min-w-0"
          style={{ color: "var(--c-text-secondary)" }}
        >
          <Clock
            size={12}
            className="shrink-0"
            style={{ color: workflow.color }}
          />
          <span className="font-medium">{job.cadence}</span>
          <span style={{ color: "var(--c-text-subtle)" }}>·</span>
          <FolderInput
            size={11}
            className="shrink-0"
            style={{ color: "var(--c-text-subtle)" }}
          />
          <span
            className="font-mono truncate"
            style={{ color: "var(--c-text-muted)" }}
          >
            {job.target}
          </span>
        </div>

        {/* Status + buttons */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] min-w-0">
            <span
              className={`schedule-status-dot ${active ? "is-active" : "is-inactive"}`}
            />
            <span
              style={{ color: active ? "#7a9e7e" : "var(--c-text-subtle)" }}
            >
              {checking
                ? "Checking…"
                : active
                  ? "Scheduled (active)"
                  : "Not scheduled"}
            </span>
            {active && status?.lastRunAt && (
              <span
                className="truncate"
                style={{ color: "var(--c-text-subtle)" }}
              >
                · last run {formatRun(status.lastRunAt)}
              </span>
            )}
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={openLog}
              title="View run log"
              className="btn btn-sm inline-flex items-center gap-1"
            >
              <ScrollText size={11} />
              Logs
            </button>

            <button
              onClick={toggle}
              disabled={busy || checking}
              className={active ? "btn btn-danger" : "btn btn-sm"}
              style={
                !active
                  ? {
                      borderColor: `${workflow.color}66`,
                      color: workflow.color,
                    }
                  : undefined
              }
            >
              {busy ? "…" : active ? "Disable" : "Enable"}
            </button>
          </div>
        </div>

        {status?.error && (
          <p
            className="text-[11px] leading-snug"
            style={{ color: "rgba(230,130,130,0.9)" }}
          >
            {status.error}
          </p>
        )}
      </div>

      {showLog && (
        <LogModal
          workflowName={workflow.name}
          logPath={status?.logPath ?? null}
          color={workflow.color}
          onClose={() => setShowLog(false)}
        />
      )}
    </>
  );
}
