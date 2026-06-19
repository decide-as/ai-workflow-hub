import { useEffect, useState } from "react";
import { X, ScrollText } from "lucide-react";

interface RunEntry {
  index: number;
  timestamp: string | null;
  moved: number;
  failed: number;
  removed: number;
}

function parseRuns(content: string): RunEntry[] {
  if (!content.trim()) return [];

  const lines = content.split("\n");
  const entries: RunEntry[] = [];

  const startIndices: number[] = [];
  lines.forEach((line, i) => {
    if (line.includes("RUN STARTED:")) startIndices.push(i);
  });

  function parseBlock(blockLines: string[]): Omit<RunEntry, "index"> {
    let timestamp: string | null = null;
    let moved = 0;
    let failed = 0;
    let removed = 0;

    for (const line of blockLines) {
      const startMatch = line.match(
        /RUN STARTED:\s*(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/,
      );
      if (startMatch) {
        timestamp = startMatch[1];
        continue;
      }
      const doneMatch = line.match(/DONE\s*[—-]\s*(.+)/);
      if (doneMatch) {
        const parts = doneMatch[1];
        const movedMatch = parts.match(/(\d+)\s+moved/);
        const failedMatch = parts.match(/(\d+)\s+failed/);
        const removedMatch = parts.match(/(\d+)\s+empty folder/);
        if (movedMatch) moved = parseInt(movedMatch[1], 10);
        if (failedMatch) failed = parseInt(failedMatch[1], 10);
        if (removedMatch) removed = parseInt(removedMatch[1], 10);
      }
    }
    return { timestamp, moved, failed, removed };
  }

  if (startIndices.length === 0) {
    const parsed = parseBlock(lines);
    entries.push({ index: 1, ...parsed });
  } else {
    startIndices.forEach((startIdx, i) => {
      const endIdx =
        i + 1 < startIndices.length ? startIndices[i + 1] : lines.length;
      const block = lines.slice(startIdx, endIdx);
      const parsed = parseBlock(block);
      entries.push({ index: i + 1, ...parsed });
    });
  }

  return entries.reverse().map((e, i) => ({ ...e, index: i + 1 }));
}

interface Props {
  workflowName: string;
  logPath: string | null;
  color: string;
  onClose: () => void;
}

export function LogModal({ workflowName, logPath, color, onClose }: Props) {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!logPath) {
      setContent("");
      return;
    }
    window.api.readLog(logPath).then(setContent);
  }, [logPath]);

  const runs = content != null ? parseRuns(content) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="modal-overlay absolute inset-0" />

      <div
        className="modal-panel relative z-10 w-full max-w-2xl mx-6 animate-fade-in flex flex-col"
        style={{ maxHeight: "calc(100vh - 80px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="h-px w-full rounded-t-[18px] shrink-0"
          style={{
            background: `linear-gradient(90deg, transparent, ${color}99, transparent)`,
          }}
        />

        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 pt-5 pb-4 shrink-0"
          style={{ borderBottom: "1px solid var(--c-border)" }}
        >
          <span
            className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0"
            style={{ backgroundColor: `${color}22` }}
          >
            <ScrollText size={16} style={{ color }} strokeWidth={1.75} />
          </span>
          <div className="flex-1 min-w-0">
            <h2
              className="text-sm font-semibold"
              style={{ color: "var(--c-text)" }}
            >
              {workflowName} — Run Log
            </h2>
            {logPath && (
              <p
                className="text-[11px] font-mono truncate mt-0.5"
                style={{ color: "var(--c-text-subtle)" }}
              >
                {logPath}
              </p>
            )}
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

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 pb-6">
          {runs === null ? (
            <p
              className="text-sm text-center py-8"
              style={{ color: "var(--c-text-muted)" }}
            >
              Loading…
            </p>
          ) : !logPath ? (
            <p
              className="text-sm text-center py-8"
              style={{ color: "var(--c-text-muted)" }}
            >
              No log file yet — enable the schedule and let it run once.
            </p>
          ) : runs.length === 0 ? (
            <p
              className="text-sm text-center py-8"
              style={{ color: "var(--c-text-muted)" }}
            >
              Log file is empty or contains no completed runs yet.
            </p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--c-border)" }}>
                  <th
                    className="text-left text-[11px] font-semibold uppercase tracking-wider py-2 pr-4 w-8"
                    style={{ color: "var(--c-text-subtle)" }}
                  >
                    #
                  </th>
                  <th
                    className="text-left text-[11px] font-semibold uppercase tracking-wider py-2 pr-4"
                    style={{ color: "var(--c-text-subtle)" }}
                  >
                    Time
                  </th>
                  <th
                    className="text-left text-[11px] font-semibold uppercase tracking-wider py-2 pr-4"
                    style={{ color: "var(--c-text-subtle)" }}
                  >
                    Result
                  </th>
                  <th
                    className="text-right text-[11px] font-semibold uppercase tracking-wider py-2"
                    style={{ color: "var(--c-text-subtle)" }}
                  >
                    Files moved
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr
                    key={run.index}
                    className="transition-colors"
                    style={{ borderBottom: "1px solid var(--c-border)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "var(--c-surface-inset)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <td
                      className="py-2.5 pr-4 tabular-nums text-xs"
                      style={{ color: "var(--c-text-subtle)" }}
                    >
                      {run.index}
                    </td>
                    <td
                      className="py-2.5 pr-4 tabular-nums text-xs"
                      style={{ color: "var(--c-text-muted)" }}
                    >
                      {run.timestamp ?? (
                        <span
                          className="italic"
                          style={{ color: "var(--c-text-subtle)" }}
                        >
                          unknown
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      {run.failed > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-red-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                          {run.failed} failed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          Success
                        </span>
                      )}
                    </td>
                    <td
                      className="py-2.5 text-right tabular-nums text-xs"
                      style={{ color: "var(--c-text-secondary)" }}
                    >
                      {run.moved}
                      {run.removed > 0 && (
                        <span
                          className="ml-1.5"
                          style={{ color: "var(--c-text-subtle)" }}
                        >
                          +{run.removed} folders cleaned
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
