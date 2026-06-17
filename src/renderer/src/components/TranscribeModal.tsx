import { useEffect, useState } from 'react'
import { X, Copy, Check, Info, Mic } from 'lucide-react'
import type { TranscriptionEntry, Workflow } from '../../../../shared/types'

interface Props {
  workflow: Workflow
  onClose: () => void
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await window.api.copyToClipboard(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg
                 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/60 transition-colors"
    >
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
    </button>
  )
}

export function TranscribeModal({ workflow, onClose }: Props) {
  const [entries, setEntries] = useState<TranscriptionEntry[]>([])

  useEffect(() => {
    window.api.getTranscriptionLog().then(setEntries)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
        <div className="flex items-center gap-3 px-6 pt-5 pb-4 shrink-0">
          <span
            className="w-9 h-9 flex items-center justify-center rounded-xl shrink-0"
            style={{ backgroundColor: `${workflow.color}22` }}
          >
            <Mic size={17} style={{ color: workflow.color }} strokeWidth={1.75} />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-zinc-100 leading-snug">{workflow.name}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Transcription log</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg
                       text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* 24h info banner */}
        <div className="mx-6 mb-4 shrink-0 flex items-start gap-2 px-3 py-2.5 rounded-lg
                        bg-zinc-800/60 border border-zinc-700/40 text-zinc-400">
          <Info size={13} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">
            Transcriptions are stored locally for <strong className="text-zinc-300">24 hours</strong> and then
            automatically deleted. Each result is also auto-copied to your clipboard when recorded.
          </p>
        </div>

        {/* Log */}
        <div className="overflow-y-auto flex-1 px-6 pb-6 space-y-3">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-600">
              <Mic size={28} strokeWidth={1.25} />
              <p className="text-sm">No transcriptions yet</p>
              <p className="text-xs text-zinc-700">Hit Record on the card to get started</p>
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="group flex items-start gap-3 p-3 rounded-xl bg-zinc-800/40
                           border border-zinc-700/30 hover:border-zinc-700/60 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-zinc-600 mb-1">{formatTimestamp(entry.timestamp)}</p>
                  <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{entry.text}</p>
                </div>
                <CopyButton text={entry.text} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
