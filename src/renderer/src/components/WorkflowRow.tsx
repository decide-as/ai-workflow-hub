import { useState } from "react";
import { Clock, Play, ExternalLink, Loader2 } from "lucide-react";
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
      className="group flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 focus:outline-none"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.background = "rgba(255,255,255,0.04)";
        el.style.border = "1px solid rgba(139,92,246,0.18)";
        el.style.boxShadow = "0 0 20px rgba(139,92,246,0.05)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background = "rgba(255,255,255,0.025)";
        el.style.border = "1px solid rgba(255,255,255,0.06)";
        el.style.boxShadow = "none";
      }}
    >
      {/* Glowing accent bar */}
      <div
        className="w-0.5 self-stretch rounded-full shrink-0"
        style={{
          background: `linear-gradient(to bottom, ${workflow.color}, ${workflow.color}44)`,
          boxShadow: `0 0 8px ${workflow.color}60`,
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
          <p
            className="font-semibold text-sm leading-snug truncate"
            style={{ color: "rgba(255,255,255,0.88)" }}
          >
            {workflow.name}
          </p>
          {clusterName && (
            <span
              className="shrink-0 text-[10px] font-medium px-1.5 py-px rounded capitalize leading-none"
              style={{
                background: clusterColor
                  ? `${clusterColor}12`
                  : "rgba(255,255,255,0.05)",
                border: `1px solid ${clusterColor ? `${clusterColor}22` : "rgba(255,255,255,0.08)"}`,
                color: clusterColor
                  ? `${clusterColor}cc`
                  : "rgba(255,255,255,0.3)",
              }}
            >
              {clusterName}
            </span>
          )}
          {workflow.scheduled_job && (
            <span
              className="inline-flex items-center gap-1 text-[10px] shrink-0"
              style={{ color: "rgba(255,255,255,0.25)" }}
            >
              <Clock size={10} style={{ color: workflow.color }} />
              {workflow.scheduled_job.cadence}
            </span>
          )}
        </div>
        <p
          className="text-xs mt-0.5 truncate"
          style={{ color: "rgba(255,255,255,0.3)" }}
        >
          {workflow.summary ?? workflow.description}
        </p>
      </div>

      {/* Tags */}
      {workflow.tags.length > 0 && (
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          {workflow.tags.slice(0, 3).map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
          <span
            className="text-[11px] w-5 text-right shrink-0"
            style={{ color: "rgba(255,255,255,0.2)" }}
          >
            {workflow.tags.length > 3 ? `+${workflow.tags.length - 3}` : ""}
          </span>
        </div>
      )}

      {/* Action button */}
      <button
        onClick={handleAction}
        disabled={loading}
        className="shrink-0 w-24 text-center text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none flex items-center justify-center gap-1.5"
        style={{
          background: "rgba(139,92,246,0.08)",
          border: "1px solid rgba(139,92,246,0.18)",
          color: "rgba(167,139,250,0.85)",
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.background = "rgba(139,92,246,0.14)";
            e.currentTarget.style.border = "1px solid rgba(139,92,246,0.3)";
            e.currentTarget.style.color = "rgba(196,181,253,1)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(139,92,246,0.08)";
          e.currentTarget.style.border = "1px solid rgba(139,92,246,0.18)";
          e.currentTarget.style.color = "rgba(167,139,250,0.85)";
        }}
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
