import { useState } from "react";
import { Clock, Play, ExternalLink, Loader2 } from "lucide-react";
import type { Workflow } from "../../../../shared/types";
import { TagBadge } from "./TagBadge";
import { resolveIcon } from "../lib/icons";

interface Props {
  workflow: Workflow;
  clusterName?: string;
  onOpen: (id: string, initialPrompt?: string) => void;
  onRun: (id: string) => void;
  onClick: (id: string) => void;
  semanticScore?: number;
}

export function WorkflowRow({
  workflow,
  clusterName,
  onOpen,
  onRun,
  onClick,
  semanticScore,
}: Props) {
  const [loading, setLoading] = useState(false);
  const Icon = resolveIcon(workflow.icon, workflow.tags);
  const isRun = workflow.action === "run";
  const isCalendar = workflow.action === "calendar";
  const isLoan = workflow.action === "loan";

  async function handleAction(e: React.MouseEvent) {
    e.stopPropagation();
    if (isCalendar || isLoan) {
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
      className="workflow-row"
    >
      {/* Left accent bar — per-workflow color */}
      <div
        className="row-accent"
        style={{
          background: `linear-gradient(to bottom, ${workflow.color}, ${workflow.color}44)`,
        }}
      />

      {/* Icon */}
      <span
        className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0"
        style={{ backgroundColor: `${workflow.color}18` }}
      >
        <Icon size={16} style={{ color: workflow.color }} strokeWidth={1.75} />
      </span>

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className="row-name truncate">{workflow.name}</p>
          {semanticScore !== undefined && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "var(--c-score)",
                letterSpacing: "0.01em",
                flexShrink: 0,
              }}
            >
              {Math.round(semanticScore * 100)}%
            </span>
          )}
          {clusterName && <span className="cluster-badge">{clusterName}</span>}
          {workflow.scheduled_job && (
            <span
              className="inline-flex items-center gap-1 text-[10px] shrink-0"
              style={{ color: "var(--c-text-subtle)" }}
            >
              <Clock size={10} style={{ color: workflow.color }} />
              {workflow.scheduled_job.cadence}
            </span>
          )}
        </div>
        <p className="row-desc truncate">
          {workflow.summary ?? workflow.description}
        </p>
      </div>

      {/* Tags — right side, hidden on small screens. +N slot always rendered for alignment */}
      {workflow.tags.length > 0 && (
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          {workflow.tags.slice(0, 3).map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
          <span
            className="text-[11px] w-5 text-right shrink-0"
            style={{ color: "var(--c-text-subtle)" }}
          >
            {workflow.tags.length > 3 ? `+${workflow.tags.length - 3}` : ""}
          </span>
        </div>
      )}

      {/* Action button */}
      <button
        onClick={handleAction}
        disabled={loading}
        className="btn btn-sm shrink-0 w-24"
      >
        {loading ? (
          <>
            <Loader2 size={11} className="animate-spin" />
            {isRun ? "Starting…" : "Opening…"}
          </>
        ) : isRun ? (
          <>
            <Play size={11} fill="currentColor" />
            Run
          </>
        ) : isCalendar ? (
          <>
            <ExternalLink size={11} />
            Create
          </>
        ) : isLoan ? (
          "New →"
        ) : (
          <>
            <ExternalLink size={11} />
            Open
          </>
        )}
      </button>
    </div>
  );
}
