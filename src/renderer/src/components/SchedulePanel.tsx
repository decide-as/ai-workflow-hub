import { useEffect, useState } from 'react'
import { Clock, FolderInput, ScrollText } from 'lucide-react'
import type { Workflow, ScheduleStatus } from '../../../../shared/types'
import { LogModal } from './LogModal'

interface Props {
  workflow: Workflow
}

function formatRun(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Compact schedule status + Enable/Disable control for a launchd-backed workflow.
// Status is refreshed every 30 s so the "last run" time stays current.
export function SchedulePanel({ workflow }: Props) {
  const job = workflow.scheduled_job
  const [status, setStatus] = useState<ScheduleStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [showLog, setShowLog] = useState(false)

  useEffect(() => {
    let alive = true
    function refresh() {
      window.api.scheduleStatus(workflow.id).then((s) => { if (alive) setStatus(s) })
    }
    refresh()
    const timer = setInterval(refresh, 30_000)
    return () => { alive = false; clearInterval(timer) }
  }, [workflow.id])

  if (!job) return null

  const active = !!status?.loaded
  const checking = status == null

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    setBusy(true)
    const next = active
      ? await window.api.scheduleDisable(workflow.id)
      : await window.api.scheduleEnable(workflow.id)
    setStatus(next)
    setBusy(false)
  }

  function openLog(e: React.MouseEvent) {
    e.stopPropagation()
    setShowLog(true)
  }

  return (
    <>
      <div
        className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2.5 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cadence · target */}
        <div className="flex items-center gap-1.5 text-xs min-w-0">
          <Clock size={12} className="shrink-0" style={{ color: workflow.color }} />
          <span className="font-medium text-zinc-200">{job.cadence}</span>
          <span className="text-zinc-600">·</span>
          <FolderInput size={11} className="shrink-0 text-zinc-500" />
          <span className="font-mono text-zinc-400 truncate">{job.target}</span>
        </div>

        {/* Status + buttons */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] min-w-0">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: active ? '#10b981' : '#52525b' }}
            />
            <span className={active ? 'text-emerald-400' : 'text-zinc-500'}>
              {checking ? 'Checking…' : active ? 'Scheduled (active)' : 'Not scheduled'}
            </span>
            {active && status?.lastRunAt && (
              <span className="text-zinc-600 truncate">· last run {formatRun(status.lastRunAt)}</span>
            )}
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={openLog}
              title="View run log"
              className="text-[11px] font-medium px-2 py-1 rounded-md border border-zinc-700/60
                         text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors
                         focus:outline-none inline-flex items-center gap-1"
            >
              <ScrollText size={11} />
              Logs
            </button>

            <button
              onClick={toggle}
              disabled={busy || checking}
              className="text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
              style={
                active
                  ? { borderColor: '#7f1d1d', color: '#fca5a5' }
                  : { borderColor: `${workflow.color}66`, color: workflow.color }
              }
            >
              {busy ? '…' : active ? 'Disable' : 'Enable'}
            </button>
          </div>
        </div>

        {status?.error && <p className="text-[11px] text-red-400 leading-snug">{status.error}</p>}
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
  )
}
