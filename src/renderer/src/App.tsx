import { useEffect, useRef, useState } from 'react'
import { LayoutGrid, List } from 'lucide-react'
import type {
  Registry, Workflow, OpenErrorKind, OpenResult, RunResult, WorkflowRunner, ScheduleStatus,
} from '../../../shared/types'
import { ClusterSection } from './components/ClusterSection'
import { SearchBar } from './components/SearchBar'
import { EmptyState } from './components/EmptyState'
import { Sidebar, type SolutionType } from './components/Sidebar'
import { WorkflowModal } from './components/WorkflowModal'
import { RunModal, type RunState, type OptionValues } from './components/RunModal'

// Seed each runner option's UI state from its defaults.
// Optional options start enabled when they have a non-zero default (e.g. min_age_days=7).
function initOptionValues(runner?: WorkflowRunner): OptionValues {
  const out: OptionValues = {}
  for (const o of runner?.options ?? []) {
    const enabledByDefault = !o.optional || (typeof o.default === 'number' && o.default > 0)
    out[o.key] = { enabled: enabledByDefault, value: o.default }
  }
  return out
}

// Turn the option UI state into CLI args, skipping disabled optional options.
function buildExtraArgs(runner: WorkflowRunner | undefined, values: OptionValues): string[] {
  const args: string[] = []
  for (const o of runner?.options ?? []) {
    const v = values[o.key]
    if (!v || (o.optional && !v.enabled)) continue
    args.push(o.flag, String(v.value))
  }
  return args
}

function workflowSolutionType(w: Workflow): SolutionType {
  if (w.scheduled_job) return 'scheduled'
  if (w.action === 'run') return 'run'
  return 'claude'
}

declare global {
  interface Window {
    api: {
      getRegistry: () => Promise<Registry>
      openWorkflow: (id: string) => Promise<OpenResult>
      pickFolder: (prompt?: string) => Promise<string | null>
      runWorkflow: (
        id: string, folder: string, apply: boolean, extraArgs?: string[],
      ) => Promise<RunResult>
      revealPath: (target: string) => Promise<string>
      scheduleStatus: (id: string) => Promise<ScheduleStatus>
      scheduleEnable: (id: string) => Promise<ScheduleStatus>
      scheduleDisable: (id: string) => Promise<ScheduleStatus>
      readLog: (logPath: string) => Promise<string>
      onRegistryUpdated: (cb: (reg: Registry) => void) => () => void
    }
  }
}

export default function App() {
  const [registry, setRegistry] = useState<Registry>({ workflows: [], clusters: [] })
  const [query, setQuery] = useState('')
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<SolutionType | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [openError, setOpenError] = useState<string | null>(null)
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null)
  const [runState, setRunState] = useState<RunState | null>(null)
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
    if (selectedType) {
      result = result.filter((w) => workflowSolutionType(w) === selectedType)
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
      setOpenError(errorMessage(result.errorKind, result.error))
      if (errorTimer.current) clearTimeout(errorTimer.current)
      errorTimer.current = setTimeout(() => setOpenError(null), 6000)
    }
  }

  function errorMessage(kind: OpenErrorKind | undefined, raw: string | undefined): string {
    switch (kind) {
      case 'permission':
        return 'Automation permission required — System Settings › Privacy & Security › Automation'
      case 'claude-missing':
        return 'claude not found in PATH — install from claude.ai/download'
      case 'path-missing':
        return raw ?? 'Repo path not found'
      default:
        return raw ?? 'Failed to open workflow'
    }
  }

  async function handleRun(id: string) {
    const workflow = registry.workflows.find((w) => w.id === id)
    if (!workflow) return
    const folder = await window.api.pickFolder(workflow.runner?.pick_prompt)
    if (!folder) return

    const options = initOptionValues(workflow.runner)
    const hasOptions = (workflow.runner?.options?.length ?? 0) > 0

    if (hasOptions) {
      setRunState({ workflow, folder, phase: 'configure', result: null, applied: false, options })
    } else {
      await startDryRun(workflow, folder, options)
    }
  }

  async function handleConfigure(options: OptionValues) {
    if (!runState) return
    const { workflow, folder } = runState
    await startDryRun(workflow, folder, options)
  }

  async function startDryRun(workflow: Workflow, folder: string, options: OptionValues) {
    setRunState({ workflow, folder, phase: 'running', result: null, applied: false, options })
    const result = await window.api.runWorkflow(
      workflow.id, folder, false, buildExtraArgs(workflow.runner, options),
    )
    const previewSupported = workflow.runner?.preview ?? true
    setRunState((prev) =>
      prev
        ? {
            ...prev,
            phase: previewSupported ? 'preview' : 'done',
            result,
            applied: !previewSupported && result.success,
          }
        : prev
    )
  }

  // Re-run the dry-run preview when the user adjusts a filter option.
  async function handleOptionsChange(next: OptionValues) {
    if (!runState) return
    const { workflow, folder } = runState
    setRunState({ ...runState, options: next, phase: 'running' })
    const result = await window.api.runWorkflow(
      workflow.id, folder, false, buildExtraArgs(workflow.runner, next)
    )
    setRunState((cur) => (cur ? { ...cur, options: next, phase: 'preview', result } : cur))
  }

  function handleApply() {
    if (!runState) return
    const { workflow, folder, options } = runState
    setRunState({ ...runState, phase: 'applying' })
    window.api
      .runWorkflow(workflow.id, folder, true, buildExtraArgs(workflow.runner, options))
      .then((result) => {
        setRunState((cur) =>
          cur ? { ...cur, phase: 'done', result, applied: result.success } : cur
        )
      })
  }

  function handleCardClick(id: string) {
    const w = registry.workflows.find((w) => w.id === id) ?? null
    setActiveWorkflow(w)
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

  const modalCluster = activeWorkflow
    ? registry.clusters.find((c) => c.id === activeWorkflow.cluster_id) ?? null
    : null

  const typeCounts = registry.workflows.reduce(
    (acc, w) => { acc[workflowSolutionType(w)]++; return acc },
    { scheduled: 0, claude: 0, run: 0 } as Record<SolutionType, number>,
  )

  return (
    <div className="flex h-screen overflow-hidden bg-[#09090b]">
      <Sidebar
        clusters={registry.clusters}
        selected={selectedCluster}
        onSelect={setSelectedCluster}
        totalCount={registry.workflows.length}
        selectedType={selectedType}
        onSelectType={setSelectedType}
        typeCounts={typeCounts}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="drag-region flex items-center gap-4 px-6 pt-10 pb-5 shrink-0">
          <div className="flex items-center gap-2 mr-auto">
            <h1 className="text-base font-semibold text-zinc-100 tracking-tight capitalize">
              {activeCluster ? activeCluster.name : 'All workflows'}
            </h1>
            <span className="text-xs text-zinc-600 tabular-nums">{filtered.length}</span>
          </div>
          <div className="no-drag flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center rounded-lg border border-zinc-800 overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                title="Grid view"
                className={`px-2.5 py-1.5 transition-colors duration-100 ${
                  viewMode === 'grid'
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                }`}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                title="List view"
                className={`px-2.5 py-1.5 transition-colors duration-100 ${
                  viewMode === 'list'
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                }`}
              >
                <List size={14} />
              </button>
            </div>
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
                  onRun={handleRun}
                  onClick={handleCardClick}
                  viewMode={viewMode}
                />
              ))}
              {unclustered.length > 0 && (
                <ClusterSection
                  cluster={{ id: '__other', name: 'Other', tags: [], workflow_ids: [] }}
                  workflows={unclustered}
                  onOpen={handleOpen}
                  onRun={handleRun}
                  onClick={handleCardClick}
                  viewMode={viewMode}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {activeWorkflow && (
        <WorkflowModal
          workflow={activeWorkflow}
          cluster={modalCluster}
          onClose={() => setActiveWorkflow(null)}
          onOpen={handleOpen}
          onRun={handleRun}
        />
      )}

      {runState && (
        <RunModal
          key={runState.folder}
          state={runState}
          onApply={handleApply}
          onReveal={(target) => window.api.revealPath(target)}
          onOptionsChange={handleOptionsChange}
          onConfigure={handleConfigure}
          onClose={() => setRunState(null)}
        />
      )}
    </div>
  )
}
