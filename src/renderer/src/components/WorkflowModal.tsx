import { useEffect } from 'react'
import { X, FolderOpen, Calendar, Tag, Layers } from 'lucide-react'
import type { Workflow, Cluster } from '../../../../shared/types'
import { TagBadge } from './TagBadge'
import { resolveIcon } from '../lib/icons'

interface Props {
  workflow: Workflow
  cluster: Cluster | null
  onClose: () => void
  onOpen: (id: string) => void
}

export function WorkflowModal({ workflow, cluster, onClose, onOpen }: Props) {
  const Icon = resolveIcon(workflow.icon, workflow.tags)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-lg mx-6 rounded-2xl bg-zinc-900 border border-zinc-800
                   shadow-2xl shadow-black/60 animate-fade-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Color stripe */}
        <div className="h-1 w-full" style={{ backgroundColor: workflow.color }} />

        {/* Header */}
        <div className="flex items-start gap-4 p-6 pb-4">
          <span
            className="w-11 h-11 flex items-center justify-center rounded-xl shrink-0 mt-0.5"
            style={{ backgroundColor: `${workflow.color}22` }}
          >
            <Icon size={22} style={{ color: workflow.color }} strokeWidth={1.75} />
          </span>

          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-zinc-100 leading-snug">{workflow.name}</h2>
            {cluster && (
              <span className="inline-flex items-center gap-1.5 mt-1 text-xs text-zinc-500">
                <Layers size={11} />
                <span className="capitalize">{cluster.name}</span>
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg
                       text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 space-y-5">
          {/* Description */}
          <p className="text-sm text-zinc-300 leading-relaxed">{workflow.description}</p>

          <div className="h-px bg-zinc-800" />

          {/* Meta rows */}
          <div className="space-y-3">
            {/* Tags */}
            <div className="flex items-start gap-3">
              <span className="flex items-center gap-1.5 text-xs text-zinc-500 w-20 shrink-0 pt-0.5">
                <Tag size={11} /> Tags
              </span>
              <div className="flex flex-wrap gap-1.5">
                {workflow.tags.map((t) => <TagBadge key={t} tag={t} />)}
              </div>
            </div>

            {/* Repo path */}
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs text-zinc-500 w-20 shrink-0">
                <FolderOpen size={11} /> Path
              </span>
              <code className="text-xs text-zinc-400 bg-zinc-800/60 border border-zinc-700/50
                               px-2 py-1 rounded-lg truncate max-w-xs">
                {workflow.repo_path}
              </code>
            </div>

            {/* Dates */}
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs text-zinc-500 w-20 shrink-0">
                <Calendar size={11} /> Added
              </span>
              <span className="text-xs text-zinc-400">{workflow.added}</span>
            </div>

            {workflow.updated !== workflow.added && (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-xs text-zinc-500 w-20 shrink-0">
                  <Calendar size={11} /> Updated
                </span>
                <span className="text-xs text-zinc-400">{workflow.updated}</span>
              </div>
            )}

            {/* ID */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 w-20 shrink-0">ID</span>
              <code className="text-xs text-zinc-600 font-mono">{workflow.id.slice(0, 8)}</code>
            </div>
          </div>

          <div className="h-px bg-zinc-800" />

          {/* Action */}
          <button
            onClick={() => { onOpen(workflow.id); onClose() }}
            className="w-full rounded-xl py-2.5 text-sm font-medium transition-all duration-150
                       text-zinc-100 border border-zinc-700/60
                       hover:border-zinc-500 hover:bg-zinc-800/60
                       focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900"
            style={{ '--tw-ring-color': workflow.color } as React.CSSProperties}
          >
            Open in Claude ↗
          </button>
        </div>
      </div>
    </div>
  )
}
