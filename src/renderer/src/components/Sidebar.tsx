import type { Cluster } from '../../../../shared/types'

function hashColor(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return `hsl(${Math.abs(h) % 360}, 65%, 58%)`
}

interface Props {
  clusters: Cluster[]
  selected: string | null
  onSelect: (id: string | null) => void
  totalCount: number
}

export function Sidebar({ clusters, selected, onSelect, totalCount }: Props) {
  return (
    <aside className="w-52 shrink-0 flex flex-col border-r border-zinc-800/60 bg-zinc-950/80 pt-12 pb-4 overflow-y-auto">
      <div className="px-3 mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 px-2 mb-1">
          Workspaces
        </p>

        <button
          onClick={() => onSelect(null)}
          className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors duration-100 ${
            selected === null
              ? 'bg-zinc-800 text-zinc-100'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-zinc-500 shrink-0" />
          <span className="flex-1 text-left font-medium">All</span>
          <span className="text-[11px] text-zinc-600 tabular-nums">{totalCount}</span>
        </button>
      </div>

      {clusters.length > 0 && (
        <div className="px-3 mt-2">
          <div className="h-px bg-zinc-800/60 mb-3" />
          <div className="space-y-0.5">
            {clusters.map((c) => {
              const color = hashColor(c.name)
              const active = selected === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors duration-100 ${
                    active
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="flex-1 text-left font-medium capitalize truncate">{c.name}</span>
                  <span className="text-[11px] text-zinc-600 tabular-nums">
                    {c.workflow_ids.length}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </aside>
  )
}
