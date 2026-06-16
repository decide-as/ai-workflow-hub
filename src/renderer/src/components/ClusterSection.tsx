import type { Cluster, Workflow } from '../../../../shared/types'
import { WorkflowCard } from './WorkflowCard'

function hashColor(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return `hsl(${Math.abs(h) % 360}, 65%, 58%)`
}

interface Props {
  cluster: Cluster
  workflows: Workflow[]
  onOpen: (id: string) => void
  onRun: (id: string) => void
  onClick: (id: string) => void
  showLabel?: boolean
}

export function ClusterSection({ cluster, workflows, onOpen, onRun, onClick, showLabel = true }: Props) {
  const color = cluster.id === '__other' ? '#52525b' : hashColor(cluster.name)

  return (
    <section className="animate-fade-in">
      {showLabel && (
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-4 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 capitalize">
            {cluster.name}
          </h2>
          <span className="text-xs text-zinc-700">{workflows.length}</span>
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(390px,1fr))] gap-3">
        {workflows.map((w) => (
          <WorkflowCard key={w.id} workflow={w} onOpen={onOpen} onRun={onRun} onClick={onClick} />
        ))}
      </div>
    </section>
  )
}
