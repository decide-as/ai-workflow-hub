import { useEffect, useRef, useState } from 'react'
import type { Registry, Workflow } from '../../../shared/types'
import { ClusterSection } from './components/ClusterSection'
import { SearchBar } from './components/SearchBar'
import { EmptyState } from './components/EmptyState'
import { Sidebar } from './components/Sidebar'

declare global {
  interface Window {
    api: {
      getRegistry: () => Promise<Registry>
      openWorkflow: (id: string) => Promise<{ success: boolean; error?: string }>
      onRegistryUpdated: (cb: (reg: Registry) => void) => () => void
    }
  }
}

export default function App() {
  const [registry, setRegistry] = useState<Registry>({ workflows: [], clusters: [] })
  const [query, setQuery] = useState('')
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    window.api.getRegistry().then(setRegistry)
    const off = window.api.onRegistryUpdated((reg) => {
      setRegistry(reg)
      setSelectedCluster((prev) =>
        prev && !reg.clusters.find((c) => c.id === prev) ? null : prev
      )
    })
    return off
  }, [])

  function filterWorkflows(workflows: Workflow[]): Workflow[] {
    let result = workflows
    if (selectedCluster) {
      result = result.filter((w) => w.cluster_id === selectedCluster)
    }
    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          w.description.toLowerCase().includes(q) ||
          w.tags.some((t) => t.toLowerCase().includes(q))
      )
    }
    return result
  }

  async function handleOpen(id: string) {
    const result = await window.api.openWorkflow(id)
    if (!result.success) {
      setOpenError(result.error ?? 'Failed to open workflow')
      if (errorTimer.current) clearTimeout(errorTimer.current)
      errorTimer.current = setTimeout(() => setOpenError(null), 4000)
    }
  }

  const filtered = filterWorkflows(registry.workflows)
  const visibleClusters = selectedCluster
    ? registry.clusters.filter((c) => c.id === selectedCluster)
    : registry.clusters

  const clustered = visibleClusters
    .map((c) => ({ cluster: c, workflows: filtered.filter((w) => w.cluster_id === c.id) }))
    .filter((g) => g.workflows.length > 0)

  const unclustered = filtered.filter((w) => w.cluster_id === null)
  const activeCluster = selectedCluster
    ? registry.clusters.find((c) => c.id === selectedCluster)
    : null

  return (
    <div className="flex h-screen overflow-hidden bg-[#09090b]">
      <Sidebar
        clusters={registry.clusters}
        selected={selectedCluster}
        onSelect={setSelectedCluster}
        totalCount={registry.workflows.length}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="drag-region flex items-center gap-4 px-6 pt-10 pb-5 shrink-0">
          <div className="flex items-center gap-2 mr-auto">
            <h1 className="text-base font-semibold text-zinc-100 tracking-tight capitalize">
              {activeCluster ? activeCluster.name : 'All workflows'}
            </h1>
            <span className="text-xs text-zinc-600 tabular-nums">{filtered.length}</span>
          </div>
          <div className="no-drag">
            <SearchBar value={query} onChange={setQuery} />
          </div>
        </header>

        {openError && (
          <div className="mx-6 mb-3 px-4 py-2.5 rounded-lg bg-red-950/60 border border-red-800/50 text-red-300 text-sm animate-fade-in">
            {openError}
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-6 pb-8">
          {registry.workflows.length === 0 ? (
            <EmptyState />
          ) : filtered.length === 0 ? (
            <p className="text-zinc-500 text-sm mt-8 text-center">
              No workflows match &ldquo;{query}&rdquo;
            </p>
          ) : (
            <div className="space-y-10">
              {clustered.map(({ cluster, workflows }) => (
                <ClusterSection
                  key={cluster.id}
                  cluster={cluster}
                  workflows={workflows}
                  onOpen={handleOpen}
                />
              ))}
              {unclustered.length > 0 && (
                <ClusterSection
                  cluster={{ id: '__other', name: 'Other', tags: [], workflow_ids: [] }}
                  workflows={unclustered}
                  onOpen={handleOpen}
                />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
