import { useEffect } from 'react'
import {
  X, FolderOpen, Calendar, Tag, Layers, Activity, Clock, Zap, DollarSign,
  Cpu, GitBranch, User, AlertCircle, CheckCircle2, XCircle, MinusCircle,
  ArrowDownToLine, ArrowUpFromLine, RefreshCw, Timer, TrendingUp,
} from 'lucide-react'
import type { Workflow, Cluster } from '../../../../shared/types'
import { TagBadge } from './TagBadge'
import { resolveIcon } from '../lib/icons'

interface Props {
  workflow: Workflow
  cluster: Cluster | null
  onClose: () => void
  onOpen: (id: string) => void
  onRun: (id: string) => void
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; Icon: typeof Activity }> = {
    active:   { label: 'Active',   color: '#10b981', Icon: CheckCircle2 },
    inactive: { label: 'Inactive', color: '#6b7280', Icon: MinusCircle },
    error:    { label: 'Error',    color: '#ef4444', Icon: XCircle },
    draft:    { label: 'Draft',    color: '#f59e0b', Icon: AlertCircle },
  }
  const cfg = map[status] ?? map.draft
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ backgroundColor: `${cfg.color}22`, color: cfg.color }}
    >
      <cfg.Icon size={10} strokeWidth={2} />
      {cfg.label}
    </span>
  )
}

function RunStatusDot({ s }: { s: string }) {
  const color = s === 'success' ? '#10b981' : s === 'failure' ? '#ef4444' : s === 'partial' ? '#f59e0b' : '#6b7280'
  const label = s.charAt(0).toUpperCase() + s.slice(1)
  return (
    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

function MetaRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex items-center gap-1.5 text-[11px] text-zinc-500 w-28 shrink-0 pt-0.5 leading-none">
        {icon}
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-2.5">
      {children}
    </p>
  )
}

function formatDuration(secs: number) {
  if (secs < 60) return `~${secs}s`
  return `~${Math.round(secs / 60)}m`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function WorkflowModal({ workflow, cluster, onClose, onOpen, onRun }: Props) {
  const Icon = resolveIcon(workflow.icon, workflow.tags)
  const isRun = workflow.action === 'run'

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const successPct = workflow.success_rate != null
    ? `${Math.round(workflow.success_rate * 100)}%`
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full max-w-xl mx-6 rounded-2xl bg-zinc-900 border border-zinc-800
                   shadow-2xl shadow-black/60 animate-fade-in flex flex-col"
        style={{ maxHeight: 'calc(100vh - 80px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Color stripe */}
        <div className="h-1 w-full rounded-t-2xl shrink-0" style={{ backgroundColor: workflow.color }} />

        {/* Header */}
        <div className="flex items-start gap-4 px-6 pt-5 pb-4 shrink-0">
          <span
            className="w-11 h-11 flex items-center justify-center rounded-xl shrink-0"
            style={{ backgroundColor: `${workflow.color}22` }}
          >
            <Icon size={22} style={{ color: workflow.color }} strokeWidth={1.75} />
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-zinc-100 leading-snug">{workflow.name}</h2>
              {workflow.status && <StatusPill status={workflow.status} />}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {cluster && (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
                  <Layers size={10} />
                  <span className="capitalize">{cluster.name}</span>
                </span>
              )}
              {workflow.version && (
                <span className="inline-flex items-center gap-1 text-[11px] text-zinc-600">
                  <GitBranch size={10} />
                  v{workflow.version}
                </span>
              )}
              {workflow.complexity && (
                <span className="text-[11px] text-zinc-600 capitalize">{workflow.complexity}</span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg
                       text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 pb-6 space-y-5">

          {/* Description */}
          <p className="text-sm text-zinc-300 leading-relaxed">{workflow.description}</p>

          <div className="h-px bg-zinc-800" />

          {/* ── Operational ─────────────────────────────────── */}
          <div>
            <SectionHeader>Operational</SectionHeader>
            <div className="space-y-2.5">
              {workflow.trigger_type && (
                <MetaRow icon={<Zap size={11} />} label="Trigger">
                  <span className="text-xs text-zinc-300 capitalize">{workflow.trigger_type}</span>
                </MetaRow>
              )}
              {workflow.schedule && (
                <MetaRow icon={<Clock size={11} />} label="Schedule">
                  <span className="text-xs text-zinc-300">{workflow.schedule}</span>
                </MetaRow>
              )}
              {workflow.owner && (
                <MetaRow icon={<User size={11} />} label="Owner">
                  <span className="text-xs text-zinc-400">{workflow.owner}</span>
                </MetaRow>
              )}
            </div>
          </div>

          <div className="h-px bg-zinc-800" />

          {/* ── Run History ──────────────────────────────────── */}
          <div>
            <SectionHeader>Run History</SectionHeader>
            <div className="space-y-2.5">
              {workflow.last_run_at && (
                <MetaRow icon={<RefreshCw size={11} />} label="Last run">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-zinc-300">{formatDate(workflow.last_run_at)}</span>
                    {workflow.last_run_status && (
                      <RunStatusDot s={workflow.last_run_status} />
                    )}
                  </div>
                </MetaRow>
              )}
              {workflow.run_count != null && (
                <MetaRow icon={<Activity size={11} />} label="Total runs">
                  <span className="text-xs text-zinc-300">{workflow.run_count.toLocaleString()}</span>
                </MetaRow>
              )}
              {successPct && (
                <MetaRow icon={<TrendingUp size={11} />} label="Success rate">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-300">{successPct}</span>
                    <div className="flex-1 max-w-[80px] h-1 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: successPct,
                          backgroundColor: workflow.success_rate! >= 0.95 ? '#10b981' : workflow.success_rate! >= 0.8 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                  </div>
                </MetaRow>
              )}
            </div>
          </div>

          <div className="h-px bg-zinc-800" />

          {/* ── Performance & Cost ───────────────────────────── */}
          <div>
            <SectionHeader>Performance & Cost</SectionHeader>
            <div className="space-y-2.5">
              {workflow.estimated_duration_seconds != null && (
                <MetaRow icon={<Timer size={11} />} label="Duration">
                  <span className="text-xs text-zinc-300">{formatDuration(workflow.estimated_duration_seconds)}</span>
                </MetaRow>
              )}
              {workflow.estimated_cost_usd != null && (
                <MetaRow icon={<DollarSign size={11} />} label="Est. cost">
                  <span className="text-xs text-zinc-300">${workflow.estimated_cost_usd.toFixed(2)} per run</span>
                </MetaRow>
              )}
              {workflow.model && (
                <MetaRow icon={<Cpu size={11} />} label="Model">
                  <code className="text-[11px] text-zinc-400 bg-zinc-800/60 border border-zinc-700/40 px-1.5 py-0.5 rounded">
                    {workflow.model}
                  </code>
                </MetaRow>
              )}
            </div>
          </div>

          {/* ── Inputs & Outputs ─────────────────────────────── */}
          {((workflow.inputs?.length ?? 0) > 0 || (workflow.outputs?.length ?? 0) > 0) && (
            <>
              <div className="h-px bg-zinc-800" />
              <div>
                <SectionHeader>Inputs & Outputs</SectionHeader>
                <div className="space-y-3">
                  {workflow.inputs && workflow.inputs.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mb-1.5">
                        <ArrowDownToLine size={10} />
                        <span>Inputs</span>
                      </div>
                      <div className="space-y-1">
                        {workflow.inputs.map((inp) => (
                          <div key={inp.name} className="flex items-start gap-2 text-xs">
                            <code className="text-zinc-300 font-mono shrink-0">{inp.name}</code>
                            <span className="text-zinc-600 shrink-0">{inp.required ? '·required' : '·optional'}</span>
                            <span className="text-zinc-500 truncate">{inp.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {workflow.outputs && workflow.outputs.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mb-1.5">
                        <ArrowUpFromLine size={10} />
                        <span>Outputs</span>
                      </div>
                      <div className="space-y-1">
                        {workflow.outputs.map((out) => (
                          <div key={out.name} className="flex items-start gap-2 text-xs">
                            <code className="text-zinc-300 font-mono shrink-0">{out.name}</code>
                            <span className="text-zinc-600 shrink-0">{out.type}</span>
                            <span className="text-zinc-500 truncate">{out.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="h-px bg-zinc-800" />

          {/* ── Tags & meta ──────────────────────────────────── */}
          <div className="space-y-2.5">
            {workflow.tags.length > 0 && (
              <MetaRow icon={<Tag size={11} />} label="Tags">
                <div className="flex flex-wrap gap-1.5">
                  {workflow.tags.map((t) => <TagBadge key={t} tag={t} />)}
                </div>
              </MetaRow>
            )}
            <MetaRow icon={<FolderOpen size={11} />} label="Repo">
              <code className="text-[11px] text-zinc-400 bg-zinc-800/60 border border-zinc-700/40
                               px-2 py-0.5 rounded-lg break-all leading-relaxed">
                {workflow.repo_path}
              </code>
            </MetaRow>
            <MetaRow icon={<Calendar size={11} />} label="Added">
              <span className="text-xs text-zinc-400">{workflow.added}</span>
            </MetaRow>
          </div>

          <div className="h-px bg-zinc-800" />

          {/* Action */}
          <button
            onClick={() => { if (isRun) onRun(workflow.id); else onOpen(workflow.id); onClose() }}
            className="w-full rounded-xl py-2.5 text-sm font-medium transition-all duration-150
                       text-zinc-100 border border-zinc-700/60
                       hover:border-zinc-500 hover:bg-zinc-800/60
                       focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900"
            style={{ '--tw-ring-color': workflow.color } as React.CSSProperties}
          >
            {isRun ? 'Run ▶' : 'Open in Claude ↗'}
          </button>
        </div>
      </div>
    </div>
  )
}
