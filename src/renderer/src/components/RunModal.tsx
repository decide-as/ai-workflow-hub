import { useEffect, useState } from 'react'
import { X, Play, FolderInput, FolderOpen, CheckCircle2, AlertCircle } from 'lucide-react'
import type { Workflow, RunResult } from '../../../../shared/types'
import { resolveIcon } from '../lib/icons'

// Per-option UI state, keyed by the option's `key`.
export type OptionValues = Record<string, { enabled: boolean; value: number }>;

// The script prints "Dest directory   : <path>" — pull it out so "Open in
// Finder" reveals exactly where the files landed. Falls back to the source
// folder, which contains the destination subfolder anyway.
function destFromOutput(output: string, fallback: string): string {
  const m = output.match(/^Dest directory\s*:\s*(.+)$/m)
  return m ? m[1].trim() : fallback
}

export type RunPhase = 'running' | 'preview' | 'applying' | 'done'

export interface RunState {
  workflow: Workflow
  folder: string
  phase: RunPhase
  result: RunResult | null
  applied: boolean
  options: OptionValues
}

interface Props {
  state: RunState
  onApply: () => void
  onReveal: (target: string) => void
  onOptionsChange: (next: OptionValues) => void
  onClose: () => void
}

function Spinner() {
  return <span className="w-3 h-3 border border-zinc-600 border-t-zinc-200 rounded-full animate-spin" />
}

export function RunModal({ state, onApply, onReveal, onOptionsChange, onClose }: Props) {
  const { workflow, folder, phase, result, applied } = state
  const Icon = resolveIcon(workflow.icon, workflow.tags)
  const busy = phase === 'running' || phase === 'applying'

  // Local mirror so typing in a number field doesn't re-run the preview on every
  // keystroke — changes are committed (and the preview re-run) on toggle/blur/Enter.
  const [optValues, setOptValues] = useState<OptionValues>(state.options)
  const runnerOptions = workflow.runner?.options ?? []
  const showOptions = runnerOptions.length > 0 && (phase === 'running' || phase === 'preview')

  function commit(next: OptionValues) {
    setOptValues(next)
    onOptionsChange(next)
  }

  // Only allow dismissing when not mid-run, so a click-away can't strand work.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const phaseLabel =
    phase === 'running' ? 'Scanning folder…'
    : phase === 'preview' ? (result?.success ? 'Preview — nothing moved yet' : 'Could not preview')
    : phase === 'applying' ? 'Applying…'
    : applied ? 'Done — files moved' : 'Closed'

  const failed = result != null && !result.success

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => !busy && onClose()}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full max-w-2xl mx-6 rounded-2xl bg-zinc-900 border border-zinc-800
                   shadow-2xl shadow-black/60 animate-fade-in flex flex-col"
        style={{ maxHeight: 'calc(100vh - 80px)' }}
        onClick={(e) => e.stopPropagation()}
      >
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
            <h2 className="text-base font-semibold text-zinc-100 leading-snug">{workflow.name}</h2>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-zinc-500 min-w-0">
              <FolderInput size={11} className="shrink-0" />
              <span className="truncate font-mono">{folder}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={busy}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg
                       text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X size={16} />
          </button>
        </div>

        {/* Phase strip */}
        <div className="px-6 pb-3 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            {busy && <Spinner />}
            {phase === 'done' && applied && <CheckCircle2 size={13} className="text-emerald-400" />}
            {failed && <AlertCircle size={13} className="text-red-400" />}
            <span className={failed ? 'text-red-300' : 'text-zinc-400'}>{phaseLabel}</span>
          </div>
        </div>

        {/* Options — adjustable filters; changing one re-runs the preview */}
        {showOptions && (
          <div className="px-6 pb-3 shrink-0 flex flex-wrap gap-x-4 gap-y-2">
            {runnerOptions.map((opt) => {
              const v = optValues[opt.key]
              if (!v) return null
              const numDisabled = busy || (opt.optional && !v.enabled)
              return (
                <div key={opt.key} className="inline-flex items-center gap-2 text-xs text-zinc-300">
                  {opt.optional && (
                    <input
                      type="checkbox"
                      checked={v.enabled}
                      disabled={busy}
                      onChange={(e) =>
                        commit({ ...optValues, [opt.key]: { ...v, enabled: e.target.checked } })
                      }
                      style={{ accentColor: workflow.color }}
                    />
                  )}
                  <span className={opt.optional && !v.enabled ? 'text-zinc-500' : ''}>{opt.label}</span>
                  <input
                    type="number"
                    min={opt.min}
                    max={opt.max}
                    value={v.value}
                    disabled={numDisabled}
                    onChange={(e) =>
                      setOptValues({ ...optValues, [opt.key]: { ...v, value: Number(e.target.value) } })
                    }
                    onBlur={() => commit(optValues)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commit(optValues) }}
                    className="w-16 rounded-md bg-zinc-800 border border-zinc-700 px-2 py-1 text-zinc-100
                               tabular-nums disabled:opacity-40 focus:outline-none focus:border-zinc-500"
                  />
                  {opt.unit && (
                    <span className={opt.optional && !v.enabled ? 'text-zinc-600' : 'text-zinc-500'}>
                      {opt.unit}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Output */}
        <div className="overflow-y-auto flex-1 px-6 pb-4">
          {result?.output ? (
            <pre className="text-[11px] leading-relaxed font-mono text-zinc-300 whitespace-pre-wrap break-words
                            bg-zinc-950/60 border border-zinc-800 rounded-lg p-3">
              {result.output}
            </pre>
          ) : failed ? (
            <p className="text-sm text-red-300">{result?.error}</p>
          ) : (
            <p className="text-sm text-zinc-500">Working…</p>
          )}
          {failed && result?.output && result?.error && (
            <p className="mt-2 text-xs text-red-300">{result.error}</p>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-800 shrink-0">
          {phase === 'preview' && result?.success && (
            <>
              <button
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-300
                           border border-zinc-700/60 hover:text-zinc-100 hover:border-zinc-600 hover:bg-zinc-800/60
                           transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onApply}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold
                           text-zinc-950 transition-all hover:brightness-110"
                style={{ backgroundColor: workflow.color }}
              >
                <Play size={14} strokeWidth={2.5} />
                Apply moves
              </button>
            </>
          )}

          {phase === 'done' && applied && (
            <button
              onClick={() => onReveal(destFromOutput(result?.output ?? '', folder))}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold
                         text-zinc-950 transition-all hover:brightness-110"
              style={{ backgroundColor: workflow.color }}
            >
              <FolderOpen size={14} strokeWidth={2.5} />
              Open in Finder
            </button>
          )}

          {(phase === 'done' || (phase === 'preview' && failed)) && (
            <button
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-200
                         border border-zinc-700/60 hover:border-zinc-500 hover:bg-zinc-800/60 transition-colors"
            >
              Close
            </button>
          )}

          {busy && (
            <span className="inline-flex items-center gap-2 text-sm text-zinc-400 px-2">
              <Spinner />
              {phase === 'applying' ? 'Moving files…' : 'Scanning…'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
