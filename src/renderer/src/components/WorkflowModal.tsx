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
} from "lucide-react";
import type {
  Workflow,
  Cluster,
  BranchListResult,
} from "../../../../shared/types";
import { TagBadge } from "./TagBadge";
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
  const map: Record<
    string,
    { label: string; color: string; Icon: typeof Activity }
  > = {
    active: { label: "Active", color: "#10b981", Icon: CheckCircle2 },
    inactive: { label: "Inactive", color: "#6b7280", Icon: MinusCircle },
    error: { label: "Error", color: "#ef4444", Icon: XCircle },
    draft: { label: "Draft", color: "#f59e0b", Icon: AlertCircle },
  };
  const cfg = map[status] ?? map.draft;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ backgroundColor: `${cfg.color}22`, color: cfg.color }}
    >
      <cfg.Icon size={10} strokeWidth={2} />
      {cfg.label}
    </span>
  );
}

function RunStatusDot({ s }: { s: string }) {
  const color =
    s === "success"
      ? "#10b981"
      : s === "failure"
        ? "#ef4444"
        : s === "partial"
          ? "#f59e0b"
          : "#6b7280";
  const label = s.charAt(0).toUpperCase() + s.slice(1);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs"
      style={{ color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function MetaRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex items-center gap-1.5 text-[11px] w-28 shrink-0 pt-0.5 leading-none" style={{ color: "rgba(255,255,255,0.28)" }}>
        {icon}
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[9px] font-medium uppercase mb-2.5"
      style={{ letterSpacing: "0.15em", color: "rgba(255,255,255,0.22)" }}
    >
      {children}
    </p>
  );
}

function formatDuration(secs: number) {
  if (secs < 60) return `~${secs}s`;
  return `~${Math.round(secs / 60)}m`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
  const [selectedBranch, setSelectedBranch] = useState(
    cfg.branch_default ?? "",
  );
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoadingBranches(true);
    window.api
      .listBranches(cfg.repo, cfg.branch_default)
      .then((result: BranchListResult) => {
        if (result.success) {
          setBranches(result.branches);
          if (!selectedBranch && result.branches.length > 0) {
            setSelectedBranch(result.branches[0]);
          }
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
      <SectionHeader>Scaffold new project</SectionHeader>

      {/* Branch picker */}
      <div className="space-y-1.5">
        <label className="text-[11px] flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
          <GitBranch size={10} />
          Branch
        </label>
        {loadingBranches ? (
          <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.28)" }}>
            <Loader2 size={12} className="animate-spin" />
            Loading branches…
          </div>
        ) : branchError ? (
          <p className="text-xs text-red-400">{branchError}</p>
        ) : (
          <div className="relative">
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full appearance-none rounded-lg px-3 py-2 text-xs pr-8 outline-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.75)",
                fontFamily: "inherit",
              }}
            >
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "rgba(255,255,255,0.3)" }}
            />
          </div>
        )}
      </div>

      {/* Description textarea */}
      <div className="space-y-1.5">
        <label className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
          What do you want to build?
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A FastAPI service that wraps the OpenAI API, with JWT auth, PostgreSQL, and a CI pipeline…"
          rows={5}
          className="w-full rounded-lg px-3 py-2 text-xs resize-none outline-none transition-all"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.75)",
            fontFamily: "inherit",
          }}
          onFocus={(e) => {
            e.currentTarget.style.border = "1px solid rgba(139,92,246,0.35)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)";
          }}
        />
      </div>

      {/* Command preview */}
      <div className="space-y-1">
        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.22)" }}>Will run</p>
        <code
          className="block text-[11px] px-2 py-1.5 rounded-lg break-all"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.35)",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {cfg.command}
        </code>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={
          submitting ||
          !selectedBranch ||
          !description.trim() ||
          loadingBranches
        }
        className="w-full rounded-xl py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{
          background: "rgba(139,92,246,0.12)",
          border: "1px solid rgba(139,92,246,0.3)",
          color: "rgba(196,181,253,0.95)",
          boxShadow: "0 0 20px rgba(139,92,246,0.08)",
        }}
        onMouseEnter={(e) => {
          if (!submitting) {
            e.currentTarget.style.background = "rgba(139,92,246,0.2)";
            e.currentTarget.style.boxShadow = "0 0 30px rgba(139,92,246,0.2)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(139,92,246,0.12)";
          e.currentTarget.style.boxShadow = "0 0 20px rgba(139,92,246,0.08)";
        }}
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Cloning & opening…
          </span>
        ) : (
          "Scaffold ↗"
        )}
      </button>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function WorkflowModal({
  workflow,
  cluster,
  onClose,
  onOpen,
  onRun,
  onScaffold,
}: Props) {
  const Icon = resolveIcon(workflow.icon, workflow.tags);
  const isRun = workflow.action === "run";
  const isScaffold = workflow.action === "scaffold";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const successPct =
    workflow.success_rate != null
      ? `${Math.round(workflow.success_rate * 100)}%`
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="absolute inset-0"
        style={{ background: "rgba(3,7,18,0.7)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      />

      <div
        className="relative z-10 w-full max-w-xl mx-6 rounded-2xl animate-slide-up flex flex-col"
        style={{
          maxHeight: "calc(100vh - 80px)",
          background: "rgba(13,17,23,0.95)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: "0 0 60px rgba(0,0,0,0.6), 0 0 40px rgba(139,92,246,0.06)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient top stripe */}
        <div
          className="h-[2px] w-full rounded-t-2xl shrink-0"
          style={{
            background: `linear-gradient(to right, transparent, ${workflow.color}, transparent)`,
            opacity: 0.9,
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
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                className="text-base font-semibold leading-snug"
                style={{ color: "rgba(255,255,255,0.9)" }}
              >
                {workflow.name}
              </h2>
              {workflow.status && <StatusPill status={workflow.status} />}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {cluster && (
                <span
                  className="inline-flex items-center gap-1.5 text-[11px]"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  <Layers size={10} />
                  <span className="capitalize">{cluster.name}</span>
                </span>
              )}
              {workflow.version && (
                <span
                  className="inline-flex items-center gap-1 text-[11px]"
                  style={{ color: "rgba(255,255,255,0.22)" }}
                >
                  <GitBranch size={10} />v{workflow.version}
                </span>
              )}
              {workflow.complexity && (
                <span
                  className="text-[11px] capitalize"
                  style={{ color: "rgba(255,255,255,0.22)" }}
                >
                  {workflow.complexity}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150"
            style={{ color: "rgba(255,255,255,0.3)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.color = "rgba(255,255,255,0.7)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "rgba(255,255,255,0.3)";
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 pb-6 space-y-5">
          {/* Description */}
          <p
            className="text-sm leading-relaxed"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            {workflow.description}
          </p>

          <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

          {/* ── Scaffold panel (replaces the standard action area) ─── */}
          {isScaffold && workflow.scaffold ? (
            <ScaffoldPanel
              workflow={workflow}
              onScaffold={onScaffold}
              onClose={onClose}
            />
          ) : (
            <>
              {/* ── Operational ──────────────────────────────────── */}
              <div>
                <SectionHeader>Operational</SectionHeader>
                <div className="space-y-2.5">
                  {workflow.trigger_type && (
                    <MetaRow icon={<Zap size={11} />} label="Trigger">
                      <span className="text-xs capitalize" style={{ color: "rgba(255,255,255,0.65)" }}>
                        {workflow.trigger_type}
                      </span>
                    </MetaRow>
                  )}
                  {workflow.schedule && (
                    <MetaRow icon={<Clock size={11} />} label="Schedule">
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                        {workflow.schedule}
                      </span>
                    </MetaRow>
                  )}
                  {workflow.owner && (
                    <MetaRow icon={<User size={11} />} label="Owner">
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                        {workflow.owner}
                      </span>
                    </MetaRow>
                  )}
                </div>
              </div>

              <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

              {/* ── Run History ──────────────────────────────────── */}
              <div>
                <SectionHeader>Run History</SectionHeader>
                <div className="space-y-2.5">
                  {workflow.last_run_at && (
                    <MetaRow icon={<RefreshCw size={11} />} label="Last run">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                          {formatDate(workflow.last_run_at)}
                        </span>
                        {workflow.last_run_status && (
                          <RunStatusDot s={workflow.last_run_status} />
                        )}
                      </div>
                    </MetaRow>
                  )}
                  {workflow.run_count != null && (
                    <MetaRow icon={<Activity size={11} />} label="Total runs">
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                        {workflow.run_count.toLocaleString()}
                      </span>
                    </MetaRow>
                  )}
                  {successPct && (
                    <MetaRow
                      icon={<TrendingUp size={11} />}
                      label="Success rate"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                          {successPct}
                        </span>
                        <div className="flex-1 max-w-[80px] h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: successPct,
                              backgroundColor:
                                workflow.success_rate! >= 0.95
                                  ? "#10b981"
                                  : workflow.success_rate! >= 0.8
                                    ? "#f59e0b"
                                    : "#ef4444",
                            }}
                          />
                        </div>
                      </div>
                    </MetaRow>
                  )}
                </div>
              </div>

              <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

              {/* ── Performance & Cost ───────────────────────────── */}
              <div>
                <SectionHeader>Performance & Cost</SectionHeader>
                <div className="space-y-2.5">
                  {workflow.estimated_duration_seconds != null && (
                    <MetaRow icon={<Timer size={11} />} label="Duration">
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                        {formatDuration(workflow.estimated_duration_seconds)}
                      </span>
                    </MetaRow>
                  )}
                  {workflow.estimated_cost_usd != null && (
                    <MetaRow icon={<DollarSign size={11} />} label="Est. cost">
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                        ${workflow.estimated_cost_usd.toFixed(2)} per run
                      </span>
                    </MetaRow>
                  )}
                  {workflow.model && (
                    <MetaRow icon={<Cpu size={11} />} label="Model">
                      <code className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", fontFamily: "ui-monospace, monospace" }}>
                        {workflow.model}
                      </code>
                    </MetaRow>
                  )}
                </div>
              </div>

              {/* ── Inputs & Outputs ─────────────────────────────── */}
              {((workflow.inputs?.length ?? 0) > 0 ||
                (workflow.outputs?.length ?? 0) > 0) && (
                <>
                  <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                  <div>
                    <SectionHeader>Inputs & Outputs</SectionHeader>
                    <div className="space-y-3">
                      {workflow.inputs && workflow.inputs.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 text-[11px] mb-1.5" style={{ color: "rgba(255,255,255,0.28)" }}>
                            <ArrowDownToLine size={10} />
                            <span>Inputs</span>
                          </div>
                          <div className="space-y-1">
                            {workflow.inputs.map((inp) => (
                              <div
                                key={inp.name}
                                className="flex items-start gap-2 text-xs"
                              >
                                <code className="shrink-0" style={{ color: "rgba(255,255,255,0.65)", fontFamily: "ui-monospace, monospace" }}>
                                  {inp.name}
                                </code>
                                <span className="shrink-0" style={{ color: "rgba(255,255,255,0.2)" }}>
                                  {inp.required ? "·required" : "·optional"}
                                </span>
                                <span className="truncate" style={{ color: "rgba(255,255,255,0.28)" }}>
                                  {inp.description}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {workflow.outputs && workflow.outputs.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 text-[11px] mb-1.5" style={{ color: "rgba(255,255,255,0.28)" }}>
                            <ArrowUpFromLine size={10} />
                            <span>Outputs</span>
                          </div>
                          <div className="space-y-1">
                            {workflow.outputs.map((out) => (
                              <div
                                key={out.name}
                                className="flex items-start gap-2 text-xs"
                              >
                                <code className="shrink-0" style={{ color: "rgba(255,255,255,0.65)", fontFamily: "ui-monospace, monospace" }}>
                                  {out.name}
                                </code>
                                <span className="shrink-0" style={{ color: "rgba(255,255,255,0.2)" }}>
                                  {out.type}
                                </span>
                                <span className="truncate" style={{ color: "rgba(255,255,255,0.28)" }}>
                                  {out.description}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

              {/* ── Tags & meta ──────────────────────────────────── */}
              <div className="space-y-2.5">
                {workflow.tags.length > 0 && (
                  <MetaRow icon={<Tag size={11} />} label="Tags">
                    <div className="flex flex-wrap gap-1.5">
                      {workflow.tags.map((t) => (
                        <TagBadge key={t} tag={t} />
                      ))}
                    </div>
                  </MetaRow>
                )}
                <MetaRow icon={<FolderOpen size={11} />} label="Repo">
                  <code
                    className="text-[11px] px-2 py-0.5 rounded-lg break-all leading-relaxed"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)", fontFamily: "ui-monospace, monospace" }}
                  >
                    {workflow.repo_path}
                  </code>
                </MetaRow>
                <MetaRow icon={<Calendar size={11} />} label="Added">
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {workflow.added}
                  </span>
                </MetaRow>
              </div>

              <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

              {/* Action */}
              <button
                onClick={() => {
                  if (isRun) onRun(workflow.id);
                  else onOpen(workflow.id);
                  onClose();
                }}
                className="w-full rounded-xl py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none flex items-center justify-center gap-2"
                style={{
                  background: "rgba(139,92,246,0.12)",
                  border: "1px solid rgba(139,92,246,0.3)",
                  color: "rgba(196,181,253,0.95)",
                  boxShadow: "0 0 20px rgba(139,92,246,0.08)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(139,92,246,0.2)";
                  e.currentTarget.style.border = "1px solid rgba(139,92,246,0.45)";
                  e.currentTarget.style.boxShadow = "0 0 30px rgba(139,92,246,0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(139,92,246,0.12)";
                  e.currentTarget.style.border = "1px solid rgba(139,92,246,0.3)";
                  e.currentTarget.style.boxShadow = "0 0 20px rgba(139,92,246,0.08)";
                }}
              >
                {isRun ? "Run" : "Open in Claude"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
