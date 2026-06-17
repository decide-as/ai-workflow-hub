import { useState } from "react";
import { Clock } from "lucide-react";
import type { Workflow } from "../../../../shared/types";
import { TagBadge } from "./TagBadge";
import { resolveIcon } from "../lib/icons";

interface Props {
  workflow: Workflow;
  clusterName?: string;
  onOpen: (id: string) => void;
  onRun: (id: string) => void;
  onClick: (id: string) => void;
}

export function WorkflowRow({
  workflow,
  clusterName,
  onOpen,
  onRun,
  onClick,
}: Props) {
  const [loading, setLoading] = useState(false);
  const Icon = resolveIcon(workflow.icon, workflow.tags);
  const isRun = workflow.action === "run";

  async function handleAction(e: React.MouseEvent) {
    e.stopPropagation();
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
      className="group flex items-center gap-4 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800/60
                 cursor-pointer transition-all duration-150
                 hover:border-zinc-700/80 hover:bg-zinc-900/80
                 focus:outline-none focus:ring-2 focus:ring-zinc-600"
    >
      {/* Color accent bar */}
      <div
        className="w-1 self-stretch rounded-full shrink-0"
        style={{ backgroundColor: workflow.color }}
      />

      {/* Icon */}
      <span
        className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0"
        style={{ backgroundColor: `${workflow.color}22` }}
      >
        <Icon size={16} style={{ color: workflow.color }} strokeWidth={1.75} />
      </span>

      {/* Name + summary */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-zinc-100 text-sm leading-snug truncate">
          {workflow.name}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5 truncate">
          {workflow.summary ?? workflow.description}
        </p>
      </div>

      {/* Tags */}
      {workflow.tags.length > 0 && (
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          {workflow.tags.slice(0, 3).map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
          {workflow.tags.length > 3 && (
            <span className="text-[11px] text-zinc-600">
              +{workflow.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Schedule indicator */}
      {workflow.scheduled_job && (
        <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] text-zinc-500 shrink-0">
          <Clock size={11} style={{ color: workflow.color }} />
          {workflow.scheduled_job.cadence}
        </span>
      )}

      {/* Cluster badge */}
      {clusterName && (
        <span className="hidden lg:block text-[11px] text-zinc-600 shrink-0 capitalize">
          {clusterName}
        </span>
      )}

      {/* Action button */}
      <button
        onClick={handleAction}
        disabled={loading}
        className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-700/60
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
        ) : (
          "Open ↗"
        )}
      </button>
    </div>
  );
}
