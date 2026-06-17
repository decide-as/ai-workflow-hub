import { useEffect, useState } from "react";
import {
  X,
  FolderOpen,
  Calendar,
  Tag,
  Layers,
  Activity,
  Clock,
  Zap,
  DollarSign,
  Cpu,
  GitBranch,
  User,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  Timer,
  TrendingUp,
  ChevronDown,
  Loader2,
  Play,
  ExternalLink,
} from "lucide-react";
import type { Workflow, Cluster, BranchListResult } from "../../../../shared/types";
import { TagBadge } from "./TagBadge";
import { SchedulePanel } from "./SchedulePanel";
import { resolveIcon } from "../lib/icons";

interface Props {
  workflow: Workflow;
  cluster: Cluster | null;
  onClose: () => void;
  onOpen: (id: string) => void;
  onRun: (id: string) => void;
  onScaffold: (id: string, branch: string, description: string) => void;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; Icon: typeof Activity }> = {
    active:   { label: "Active",   color: "#7a9e7e", Icon: CheckCircle2 },
    inactive: { label: "Inactive", color: "var(--c-text-subtle)", Icon: MinusCircle },
    error:    { label: "Error",    color: "rgba(220,100,100,0.9)", Icon: XCircle },
    draft:    { label: "Draft",    color: "var(--c-accent)", Icon: AlertCircle },
  };
  const cfg = map[status] ?? map.draft;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ backgroundColor: `${cfg.color}1a`, color: cfg.color }}
    >
      <cfg.Icon size={10} strokeWidth={2} />
      {cfg.label}
    </span>
  );
}

function RunStatusDot({ s }: { s: string }) {
  const color =
    s === "success" ? "#7a9e7e" :
    s === "failure" ? "rgba(220,100,100,0.9)" :
    s === "partial" ? "var(--c-accent)" :
    "var(--c-text-subtle)";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

function MetaRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="meta-label">{icon}{label}</span>
      <div className="flex-1 min-w-0 meta-value">{children}</div>
    </div>
  );
}

function formatDuration(secs: number) {
  if (secs < 60) return `~${secs}s`;
  return `~${Math.round(secs / 60)}m`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Scaffold panel ────────────────────────────────────────────────────────────

function ScaffoldPanel({
  workflow,
  onScaffold,
  onClose,
}: {
  workflow: Workflow;
  onScaffold: (id: string, branch: string, description: string) => void;
  onClose: () => void;
}) {
  const cfg = workflow.scaffold!;
  const [branches, setBranches] = useState<string[]>([]);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState(cfg.branch_default ?? "");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoadingBranches(true);
    window.api
      .listBranches(cfg.repo, cfg.branch_default)
      .then((result: BranchListResult) => {
        if (result.success) {
          setBranches(result.branches);
          if (!selectedBranch && result.branches.length > 0) setSelectedBranch(result.branches[0]);
        } else {
          setBranchError(result.error ?? "Could not list branches");
        }
      })
      .finally(() => setLoadingBranches(false));
  }, [cfg.repo, cfg.branch_default]);

  async function handleSubmit() {
    if (!selectedBranch || !description.trim()) return;
    setSubmitting(true);
    await onScaffold(workflow.id, selectedBranch, description.trim());
    setSubmitting(false);
    onClose();
  }

  return (
    <div className="space-y-4">
      <p className="modal-section-label">Scaffold new project</p>

      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--c-text-muted)" }}>
          <GitBranch size={10} />Branch
        </label>
        {loadingBranches ? (
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--c-text-muted)" }}>
            <Loader2 size={12} className="animate-spin" />Loading branches…
          </div>
        ) : branchError ? (
          <p className="text-xs" style={{ color: "rgba(220,100,100,0.9)" }}>{branchError}</p>
        ) : (
          <div className="relative">
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="form-input form-select"
            >
              {branches.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--c-text-muted)" }} />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px]" style={{ color: "var(--c-text-muted)" }}>
          What do you want to build?
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A FastAPI service that wraps the OpenAI API, with JWT auth, PostgreSQL, and a CI pipeline…"
          rows={5}
          className="form-input resize-none"
        />
      </div>

      <div className="space-y-1">
        <p className="text-[10px]" style={{ color: "var(--c-text-subtle)" }}>Will run</p>
        <code className="code-block">{cfg.command}</code>
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting || !selectedBranch || !description.trim() || loadingBranches}
        className="btn btn-primary"
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" />Cloning & opening…
          </span>
        ) : "Scaffold ↗"}
      </button>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function WorkflowModal({ workflow, cluster, onClose, onOpen, onRun, onScaffold }: Props) {
  const Icon = resolveIcon(workflow.icon, workflow.tags);
  const isRun = workflow.action === "run";
  const isScaffold = workflow.action === "scaffold";

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const successPct = workflow.success_rate != null ? `${Math.round(workflow.success_rate * 100)}%` : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="modal-overlay absolute inset-0" />

      <div
        className="modal-panel relative z-10 w-full max-w-xl mx-6 animate-slide-up flex flex-col"
        style={{ maxHeight: "calc(100vh - 80px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent stripe */}
        <div
          className="h-px w-full rounded-t-[18px] shrink-0"
          style={{ background: `linear-gradient(90deg, transparent, ${workflow.color}99, transparent)` }}
        />

        {/* Header */}
        <div className="flex items-start gap-4 px-6 pt-5 pb-4 shrink-0">
          <span
            className="w-11 h-11 flex items-center justify-center rounded-xl shrink-0"
            style={{ backgroundColor: `${workflow.color}18` }}
          >
            <Icon size={22} style={{ color: workflow.color }} strokeWidth={1.75} />
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[15px] font-semibold leading-snug" style={{ color: "var(--c-text)" }}>
                {workflow.name}
              </h2>
              {workflow.status && <StatusPill status={workflow.status} />}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {cluster && (
                <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: "var(--c-text-muted)" }}>
                  <Layers size={10} /><span className="capitalize">{cluster.name}</span>
                </span>
              )}
              {workflow.version && (
                <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--c-text-subtle)" }}>
                  <GitBranch size={10} />v{workflow.version}
                </span>
              )}
              {workflow.complexity && (
                <span className="text-[11px] capitalize" style={{ color: "var(--c-text-subtle)" }}>
                  {workflow.complexity}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn shrink-0 w-8 h-8"
            style={{ color: "var(--c-text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(169,146,125,0.06)"; e.currentTarget.style.color = "var(--c-text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--c-text-muted)"; }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 pb-6 space-y-5">
          <p className="text-sm leading-relaxed" style={{ color: "var(--c-text-muted)" }}>
            {workflow.description}
          </p>

          <div className="divider" />

          {isScaffold && workflow.scaffold ? (
            <ScaffoldPanel workflow={workflow} onScaffold={onScaffold} onClose={onClose} />
          ) : (
            <>
              {/* Live schedule status */}
              {workflow.scheduled_job && (
                <>
                  <div>
                    <p className="modal-section-label">Schedule</p>
                    <SchedulePanel workflow={workflow} />
                  </div>
                  <div className="divider" />
                </>
              )}

              {/* Operational */}
              <div>
                <p className="modal-section-label">Operational</p>
                <div className="space-y-2.5">
                  {workflow.trigger_type && (
                    <MetaRow icon={<Zap size={11} />} label="Trigger">
                      <span className="capitalize">{workflow.trigger_type}</span>
                    </MetaRow>
                  )}
                  {workflow.schedule && (
                    <MetaRow icon={<Clock size={11} />} label="Schedule">
                      {workflow.schedule}
                    </MetaRow>
                  )}
                  {workflow.owner && (
                    <MetaRow icon={<User size={11} />} label="Owner">
                      {workflow.owner}
                    </MetaRow>
                  )}
                </div>
              </div>

              <div className="divider" />

              {/* Run History */}
              <div>
                <p className="modal-section-label">Run History</p>
                <div className="space-y-2.5">
                  {workflow.last_run_at && (
                    <MetaRow icon={<RefreshCw size={11} />} label="Last run">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{formatDate(workflow.last_run_at)}</span>
                        {workflow.last_run_status && <RunStatusDot s={workflow.last_run_status} />}
                      </div>
                    </MetaRow>
                  )}
                  {workflow.run_count != null && (
                    <MetaRow icon={<Activity size={11} />} label="Total runs">
                      {workflow.run_count.toLocaleString()}
                    </MetaRow>
                  )}
                  {successPct && (
                    <MetaRow icon={<TrendingUp size={11} />} label="Success rate">
                      <div className="flex items-center gap-2">
                        <span>{successPct}</span>
                        <div className="flex-1 max-w-[80px] h-1 rounded-full overflow-hidden" style={{ background: "var(--c-border)" }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: successPct,
                              backgroundColor:
                                workflow.success_rate! >= 0.95 ? "#7a9e7e" :
                                workflow.success_rate! >= 0.8 ? "var(--c-accent)" :
                                "rgba(200,100,100,0.8)",
                            }}
                          />
                        </div>
                      </div>
                    </MetaRow>
                  )}
                </div>
              </div>

              <div className="divider" />

              {/* Performance & Cost */}
              <div>
                <p className="modal-section-label">Performance & Cost</p>
                <div className="space-y-2.5">
                  {workflow.estimated_duration_seconds != null && (
                    <MetaRow icon={<Timer size={11} />} label="Duration">
                      {formatDuration(workflow.estimated_duration_seconds)}
                    </MetaRow>
                  )}
                  {workflow.estimated_cost_usd != null && (
                    <MetaRow icon={<DollarSign size={11} />} label="Est. cost">
                      ${workflow.estimated_cost_usd.toFixed(2)} per run
                    </MetaRow>
                  )}
                  {workflow.model && (
                    <MetaRow icon={<Cpu size={11} />} label="Model">
                      <code className="code-inline">{workflow.model}</code>
                    </MetaRow>
                  )}
                </div>
              </div>

              {/* Inputs & Outputs */}
              {((workflow.inputs?.length ?? 0) > 0 || (workflow.outputs?.length ?? 0) > 0) && (
                <>
                  <div className="divider" />
                  <div>
                    <p className="modal-section-label">Inputs & Outputs</p>
                    <div className="space-y-3">
                      {workflow.inputs && workflow.inputs.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 text-[11px] mb-1.5" style={{ color: "var(--c-text-muted)" }}>
                            <ArrowDownToLine size={10} /><span>Inputs</span>
                          </div>
                          <div className="space-y-1">
                            {workflow.inputs.map((inp) => (
                              <div key={inp.name} className="flex items-start gap-2 text-xs">
                                <code className="code-inline shrink-0">{inp.name}</code>
                                <span className="shrink-0" style={{ color: "var(--c-text-subtle)" }}>
                                  {inp.required ? "·required" : "·optional"}
                                </span>
                                <span className="truncate" style={{ color: "var(--c-text-subtle)" }}>{inp.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {workflow.outputs && workflow.outputs.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 text-[11px] mb-1.5" style={{ color: "var(--c-text-muted)" }}>
                            <ArrowUpFromLine size={10} /><span>Outputs</span>
                          </div>
                          <div className="space-y-1">
                            {workflow.outputs.map((out) => (
                              <div key={out.name} className="flex items-start gap-2 text-xs">
                                <code className="code-inline shrink-0">{out.name}</code>
                                <span className="shrink-0" style={{ color: "var(--c-text-subtle)" }}>{out.type}</span>
                                <span className="truncate" style={{ color: "var(--c-text-subtle)" }}>{out.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="divider" />

              {/* Tags & meta */}
              <div className="space-y-2.5">
                {workflow.tags.length > 0 && (
                  <MetaRow icon={<Tag size={11} />} label="Tags">
                    <div className="flex flex-wrap gap-1.5">
                      {workflow.tags.map((t) => <TagBadge key={t} tag={t} />)}
                    </div>
                  </MetaRow>
                )}
                <MetaRow icon={<FolderOpen size={11} />} label="Repo">
                  <code className="code-block">{workflow.repo_path}</code>
                </MetaRow>
                <MetaRow icon={<Calendar size={11} />} label="Added">
                  {workflow.added}
                </MetaRow>
              </div>

              <div className="divider" />

              {/* Primary action */}
              <button
                onClick={() => { if (isRun) onRun(workflow.id); else onOpen(workflow.id); onClose(); }}
                className="btn btn-primary"
              >
                {isRun ? <><Play size={14} fill="currentColor" />Run</> : <><ExternalLink size={13} />Open in Claude</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
