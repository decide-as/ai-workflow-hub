import { useState } from "react";
import type { Workflow } from "../../../../shared/types";
import { TagBadge } from "./TagBadge";
import { SchedulePanel } from "./SchedulePanel";
import { resolveIcon } from "../lib/icons";

interface Props {
  workflow: Workflow;
  onOpen: (id: string) => void;
  onRun: (id: string) => void;
  onClick: (id: string) => void;
}

export function WorkflowCard({ workflow, onOpen, onRun, onClick }: Props) {
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
      className="group relative flex flex-col rounded-2xl bg-zinc-900 border border-zinc-800/60
                 overflow-hidden transition-all duration-200 cursor-pointer
                 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-black/50 hover:border-zinc-700/80
                 focus:outline-none focus:ring-2 focus:ring-zinc-600"
    >
      <div
        className="h-[3px] w-full shrink-0"
        style={{ backgroundColor: workflow.color }}
      />

      <div className="flex flex-col flex-1 p-5 gap-3">
        <div className="flex items-start gap-3">
          <span
            className="w-9 h-9 flex items-center justify-center rounded-xl shrink-0"
            style={{ backgroundColor: `${workflow.color}22` }}
          >
            <Icon
              size={18}
              style={{ color: workflow.color }}
              strokeWidth={1.75}
            />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="font-semibold text-zinc-100 leading-snug truncate">
              {workflow.name}
            </p>
            <p className="text-sm text-zinc-300 mt-1 truncate leading-relaxed">
              {workflow.summary ?? workflow.description}
            </p>
          </div>
        </div>

        {workflow.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {workflow.tags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>
        )}

        {workflow.scheduled_job && <SchedulePanel workflow={workflow} />}

        <div className="flex-1" />

        <button
          onClick={handleAction}
          disabled={loading}
          className="w-full rounded-xl py-2.5 text-sm font-medium transition-all duration-150
                     border border-zinc-700/60 text-zinc-300
                     hover:text-zinc-100 hover:border-zinc-600 hover:bg-zinc-800/60
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-3 border border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
              {isRun ? "Starting…" : "Opening…"}
            </span>
          ) : isRun ? (
            "Run ▶"
          ) : (
            "Open in Claude ↗"
          )}
        </button>
      </div>
    </div>
  );
}
