import { useState } from "react";
import { Clock } from "lucide-react";
import type { Workflow } from "../../../../shared/types";
import { TagBadge } from "./TagBadge";
import { resolveIcon } from "../lib/icons";

interface Props {
  workflow: Workflow;
  clusterName?: string;
  clusterColor?: string;
  onOpen: (id: string) => void;
  onRun: (id: string) => void;
  onClick: (id: string) => void;
}

export function WorkflowRow({
  workflow,
  clusterName,
  clusterColor,
  onOpen,
  onRun,
  onClick,
}: Props) {
  const [loading, setLoading] = useState(false);
  const Icon = resolveIcon(workflow.icon, workflow.tags);
  const isRun = workflow.action === "run";
  const isCalendar = workflow.action === "calendar";

  async function handleAction(e: React.MouseEvent) {
    e.stopPropagation();
    if (isCalendar) {
      onClick(workflow.id);
      return;
    }
    setLoading(true);
    await (isRun ? onRun(workflow.id) : onOpen(workflow.id));
    setTimeout(() => setLoading(false), 800);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(workflow.id)}
      onKeyDown={(e) => e.key === "Enter" && onClick(workflow.id)}
      className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800/60
                 cursor-pointer transition-all duration-150
                 hover:border-zinc-700/80 hover:bg-zinc-900/80
                 focus:outline-none focus:ring-2 focus:ring-zinc-600"
    >
      {/* Color accent bar */}
      <div
        className="w-0.5 self-stretch rounded-full shrink-0"
        style={{ backgroundColor: workflow.color }}
      />

      {/* Icon */}
      <span
        className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0"
        style={{ backgroundColor: `${workflow.color}22` }}
      >
        <Icon size={16} style={{ color: workflow.color }} strokeWidth={1.75} />
      </span>

      {/* Name + workspace badge + schedule + description — left group takes remaining space */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-semibold text-zinc-100 text-sm leading-snug truncate">
            {workflow.name}
          </p>
          {clusterName && (
            <span
              className="shrink-0 text-[10px] font-medium px-1.5 py-px rounded border capitalize leading-none
                         bg-zinc-800/80 border-zinc-700/80 text-zinc-500"
              style={
                clusterColor
                  ? {
                      borderColor: `${clusterColor}30`,
                      color: `${clusterColor}cc`,
                    }
                  : undefined
              }
            >
              {clusterName}
            </span>
          )}
          {workflow.scheduled_job && (
            <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 shrink-0">
              <Clock size={10} style={{ color: workflow.color }} />
              {workflow.scheduled_job.cadence}
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500 mt-0.5 truncate">
          {workflow.summary ?? workflow.description}
        </p>
      </div>

      {/* Tags — right side, hidden on small screens. +N slot always rendered for alignment */}
      {workflow.tags.length > 0 && (
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          {workflow.tags.slice(0, 3).map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
          <span className="text-[11px] text-zinc-600 w-5 text-right shrink-0">
            {workflow.tags.length > 3 ? `+${workflow.tags.length - 3}` : ""}
          </span>
        </div>
      )}

      {/* Action button — fixed width so all rows align */}
      <button
        onClick={handleAction}
        disabled={loading}
        className="shrink-0 w-24 text-center text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-700/60
                   text-zinc-300 hover:text-zinc-100 hover:border-zinc-600 hover:bg-zinc-800/60
                   transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed
                   focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900"
      >
        {loading ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 border border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
            {isRun ? "Starting…" : "Opening…"}
          </span>
        ) : isRun ? (
          "Run ▶"
        ) : isCalendar ? (
          "Create →"
        ) : (
          "Open ↗"
        )}
      </button>
    </div>
  );
}
