import { useEffect, useRef, useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import type {
  Registry,
  Workflow,
  OpenErrorKind,
  OpenResult,
  RunResult,
  WorkflowRunner,
  ScheduleStatus,
  BranchListResult,
  ActivityEntry,
  TranscriptionEntry,
  ReadingListEntry,
  ReadingListImportResult,
  ReadingListAddResult,
} from "../../../shared/types";
import { WorkflowCard } from "./components/WorkflowCard";
import { WorkflowRow } from "./components/WorkflowRow";
import { SearchBar } from "./components/SearchBar";
import { EmptyState } from "./components/EmptyState";
import { Sidebar, type SolutionType } from "./components/Sidebar";
import { WorkflowModal } from "./components/WorkflowModal";
import {
  RunModal,
  type RunState,
  type OptionValues,
} from "./components/RunModal";
import { TranscribeModal } from "./components/TranscribeModal";
import { ReadingListModal } from "./components/ReadingListModal";
import { CalendarModal } from "./components/CalendarModal";

// Seed each runner option's UI state from its defaults.
// Optional options start enabled when they have a non-zero default (e.g. min_age_days=7).
function initOptionValues(runner?: WorkflowRunner): OptionValues {
  const out: OptionValues = {};
  for (const o of runner?.options ?? []) {
    const enabledByDefault =
      !o.optional || (typeof o.default === "number" && o.default > 0);
    out[o.key] = { enabled: enabledByDefault, value: o.default };
  }
  return out;
}

// Turn the option UI state into CLI args, skipping disabled optional options.
function buildExtraArgs(
  runner: WorkflowRunner | undefined,
  values: OptionValues,
): string[] {
  const args: string[] = [];
  for (const o of runner?.options ?? []) {
    const v = values[o.key];
    if (!v || (o.optional && !v.enabled)) continue;
    args.push(o.flag, String(v.value));
  }
  return args;
}

function workflowSolutionType(w: Workflow): SolutionType {
  if (w.scheduled_job) return "scheduled";
  if (
    w.action === "run" ||
    w.action === "reading-list" ||
    w.action === "transcribe"
  )
    return "routine";
  if (w.action === "scaffold") return "claude";
  return "claude";
}

function hashColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 360}, 65%, 58%)`;
}

declare global {
  interface Window {
    api: {
      getRegistry: () => Promise<Registry>;
      openWorkflow: (id: string, initialPrompt?: string) => Promise<OpenResult>;
      pickFolder: (prompt?: string) => Promise<string | null>;
      runWorkflow: (
        id: string,
        folder: string,
        apply: boolean,
        extraArgs?: string[],
      ) => Promise<RunResult>;
      revealPath: (target: string) => Promise<string>;
      scheduleStatus: (id: string) => Promise<ScheduleStatus>;
      scheduleEnable: (id: string) => Promise<ScheduleStatus>;
      scheduleDisable: (id: string) => Promise<ScheduleStatus>;
      readLog: (logPath: string) => Promise<string>;
      listBranches: (
        repo: string,
        defaultBranch?: string,
      ) => Promise<BranchListResult>;
      scaffoldWorkflow: (
        id: string,
        branch: string,
        description: string,
      ) => Promise<OpenResult>;
      writeActivityLog: (entry: ActivityEntry) => Promise<{ success: boolean }>;
      onRegistryUpdated: (cb: (reg: Registry) => void) => () => void;
      transcribeAudio: (audioBuffer: ArrayBuffer) => Promise<string>;
      copyToClipboard: (text: string) => Promise<void>;
      getTranscriptionLog: () => Promise<TranscriptionEntry[]>;
      saveTranscription: (text: string) => Promise<TranscriptionEntry>;
      readingListImport: () => Promise<ReadingListImportResult>;
      readingListAddUrl: (url: string) => Promise<ReadingListAddResult>;
      readingListGetEntries: (limit?: number) => Promise<ReadingListEntry[]>;
      execOsascript: (
        script: string,
      ) => Promise<{ success: boolean; output: string; error?: string }>;
      readClipboardImage: () => Promise<string | null>;
      generateCalendarScript: (
        text: string,
        imageDataUrl: string | null,
        today: string,
      ) => Promise<{ success: boolean; script: string; error?: string }>;
    };
  }
}

export default function App() {
  const [registry, setRegistry] = useState<Registry>({
    workflows: [],
    clusters: [],
  });
  const [query, setQuery] = useState("");
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<SolutionType | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [openError, setOpenError] = useState<string | null>(null);
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
  const [transcribeWorkflow, setTranscribeWorkflow] = useState<Workflow | null>(
    null,
  );
  const [readingListWorkflow, setReadingListWorkflow] =
    useState<Workflow | null>(null);
  const [calendarWorkflow, setCalendarWorkflow] = useState<Workflow | null>(
    null,
  );
  const [runState, setRunState] = useState<RunState | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    window.api.getRegistry().then(setRegistry);
    const off = window.api.onRegistryUpdated((reg) => {
      setRegistry(reg);
      setSelectedCluster((prev) =>
        prev && !reg.clusters.find((c) => c.id === prev) ? null : prev,
      );
    });
    return off;
  }, []);

  function filterWorkflows(workflows: Workflow[]): Workflow[] {
    let result = workflows;
    if (selectedCluster) {
      result = result.filter((w) => w.cluster_id === selectedCluster);
    }
    if (selectedType) {
      result = result.filter((w) => workflowSolutionType(w) === selectedType);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          w.description.toLowerCase().includes(q) ||
          w.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return result;
  }

  async function handleOpen(id: string, initialPrompt?: string) {
    const result = await window.api.openWorkflow(id, initialPrompt);
    if (!result.success) {
      setOpenError(errorMessage(result.errorKind, result.error));
      if (errorTimer.current) clearTimeout(errorTimer.current);
      errorTimer.current = setTimeout(() => setOpenError(null), 6000);
    }
  }

  function errorMessage(
    kind: OpenErrorKind | undefined,
    raw: string | undefined,
  ): string {
    switch (kind) {
      case "permission":
        return "Automation permission required — System Settings › Privacy & Security › Automation";
      case "claude-missing":
        return "claude not found in PATH — install from claude.ai/download";
      case "path-missing":
        return raw ?? "Repo path not found";
      default:
        return raw ?? "Failed to open workflow";
    }
  }

  async function handleRun(id: string) {
    const workflow = registry.workflows.find((w) => w.id === id);
    if (!workflow) return;
    const folder = await window.api.pickFolder(workflow.runner?.pick_prompt);
    if (!folder) return;

    const options = initOptionValues(workflow.runner);
    const hasOptions = (workflow.runner?.options?.length ?? 0) > 0;

    if (hasOptions) {
      setRunState({
        workflow,
        folder,
        phase: "configure",
        result: null,
        applied: false,
        options,
      });
    } else {
      await startDryRun(workflow, folder, options);
    }
  }

  async function handleConfigure(options: OptionValues) {
    if (!runState) return;
    const { workflow, folder } = runState;
    await startDryRun(workflow, folder, options);
  }

  async function startDryRun(
    workflow: Workflow,
    folder: string,
    options: OptionValues,
  ) {
    setRunState({
      workflow,
      folder,
      phase: "running",
      result: null,
      applied: false,
      options,
    });
    const result = await window.api.runWorkflow(
      workflow.id,
      folder,
      false,
      buildExtraArgs(workflow.runner, options),
    );
    const previewSupported = workflow.runner?.preview ?? true;
    setRunState((prev) =>
      prev
        ? {
            ...prev,
            phase: previewSupported ? "preview" : "done",
            result,
            applied: !previewSupported && result.success,
          }
        : prev,
    );
  }

  // Re-run the dry-run preview when the user adjusts a filter option.
  async function handleOptionsChange(next: OptionValues) {
    if (!runState) return;
    const { workflow, folder } = runState;
    setRunState({ ...runState, options: next, phase: "running" });
    const result = await window.api.runWorkflow(
      workflow.id,
      folder,
      false,
      buildExtraArgs(workflow.runner, next),
    );
    setRunState((cur) =>
      cur ? { ...cur, options: next, phase: "preview", result } : cur,
    );
  }

  function handleApply() {
    if (!runState) return;
    const { workflow, folder, options } = runState;
    setRunState({ ...runState, phase: "applying" });
    window.api
      .runWorkflow(
        workflow.id,
        folder,
        true,
        buildExtraArgs(workflow.runner, options),
      )
      .then((result) => {
        setRunState((cur) =>
          cur
            ? { ...cur, phase: "done", result, applied: result.success }
            : cur,
        );
      });
  }

  async function handleScaffold(
    id: string,
    branch: string,
    description: string,
  ) {
    const result = await window.api.scaffoldWorkflow(id, branch, description);
    if (!result.success) {
      setOpenError(errorMessage(result.errorKind, result.error));
      if (errorTimer.current) clearTimeout(errorTimer.current);
      errorTimer.current = setTimeout(() => setOpenError(null), 6000);
    }
  }

  function handleCardClick(id: string) {
    const w = registry.workflows.find((w) => w.id === id) ?? null;
    if (w?.action === "transcribe") {
      setTranscribeWorkflow(w);
    } else if (w?.action === "reading-list") {
      setReadingListWorkflow(w);
    } else if (w?.action === "calendar") {
      setCalendarWorkflow(w);
    } else {
      setActiveWorkflow(w);
    }
  }

  const filtered = filterWorkflows(registry.workflows);
  const activeCluster = selectedCluster
    ? registry.clusters.find((c) => c.id === selectedCluster)
    : null;

  const modalCluster = activeWorkflow
    ? (registry.clusters.find((c) => c.id === activeWorkflow.cluster_id) ??
      null)
    : null;

  const typeCounts = registry.workflows.reduce(
    (acc, w) => {
      acc[workflowSolutionType(w)]++;
      return acc;
    },
    { scheduled: 0, claude: 0, routine: 0 } as Record<SolutionType, number>,
  );

  // Only show workspace badges when viewing all workspaces (no filter active)
  const showWorkspaceBadges = !selectedCluster;

  function clusterForWorkflow(w: Workflow) {
    if (!w.cluster_id) return null;
    return registry.clusters.find((c) => c.id === w.cluster_id) ?? null;
  }

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
              {activeCluster ? activeCluster.name : "All workflows"}
            </h1>
            <span className="text-xs text-zinc-600 tabular-nums">
              {filtered.length}
            </span>
          </div>
          <div className="no-drag flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center rounded-lg border border-zinc-800 overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                title="Grid view"
                className={`px-2.5 py-1.5 transition-colors duration-100 ${
                  viewMode === "grid"
                    ? "bg-zinc-700 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                }`}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                title="List view"
                className={`px-2.5 py-1.5 transition-colors duration-100 ${
                  viewMode === "list"
                    ? "bg-zinc-700 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
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
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(390px,1fr))] gap-3 animate-fade-in">
              {filtered.map((w) => {
                const cluster = showWorkspaceBadges
                  ? clusterForWorkflow(w)
                  : null;
                return (
                  <WorkflowCard
                    key={w.id}
                    workflow={w}
                    clusterName={cluster?.name}
                    clusterColor={cluster ? hashColor(cluster.name) : undefined}
                    onOpen={handleOpen}
                    onRun={handleRun}
                    onClick={handleCardClick}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 animate-fade-in">
              {filtered.map((w) => {
                const cluster = showWorkspaceBadges
                  ? clusterForWorkflow(w)
                  : null;
                return (
                  <WorkflowRow
                    key={w.id}
                    workflow={w}
                    clusterName={cluster?.name}
                    clusterColor={cluster ? hashColor(cluster.name) : undefined}
                    onOpen={handleOpen}
                    onRun={handleRun}
                    onClick={handleCardClick}
                  />
                );
              })}
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
          onScaffold={handleScaffold}
        />
      )}

      {transcribeWorkflow && (
        <TranscribeModal
          workflow={transcribeWorkflow}
          onClose={() => setTranscribeWorkflow(null)}
        />
      )}

      {readingListWorkflow && (
        <ReadingListModal
          workflow={readingListWorkflow}
          onClose={() => setReadingListWorkflow(null)}
        />
      )}

      {calendarWorkflow && (
        <CalendarModal
          workflow={calendarWorkflow}
          onClose={() => setCalendarWorkflow(null)}
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
  );
}
