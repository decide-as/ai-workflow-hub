import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "../../shared/ipc-channels";
import type {
  Registry,
  OpenResult,
  RunResult,
  ScheduleStatus,
  BranchListResult,
  ActivityEntry,
  TranscriptionEntry,
  ReadingListEntry,
  ReadingListImportResult,
  ReadingListAddResult,
} from "../../shared/types";

contextBridge.exposeInMainWorld("api", {
  getRegistry: (): Promise<Registry> => ipcRenderer.invoke(IPC.GET_REGISTRY),
  openWorkflow: (id: string, initialPrompt?: string): Promise<OpenResult> =>
    ipcRenderer.invoke(IPC.OPEN_WORKFLOW, id, initialPrompt),
  pickFolder: (prompt?: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.PICK_FOLDER, prompt),
  runWorkflow: (
    id: string,
    folder: string,
    apply: boolean,
    extraArgs: string[] = [],
  ): Promise<RunResult> =>
    ipcRenderer.invoke(IPC.RUN_WORKFLOW, id, folder, apply, extraArgs),
  revealPath: (target: string): Promise<string> =>
    ipcRenderer.invoke(IPC.REVEAL_PATH, target),
  scheduleStatus: (id: string): Promise<ScheduleStatus> =>
    ipcRenderer.invoke(IPC.SCHEDULE_STATUS, id),
  scheduleEnable: (id: string): Promise<ScheduleStatus> =>
    ipcRenderer.invoke(IPC.SCHEDULE_ENABLE, id),
  scheduleDisable: (id: string): Promise<ScheduleStatus> =>
    ipcRenderer.invoke(IPC.SCHEDULE_DISABLE, id),
  readLog: (logPath: string): Promise<string> =>
    ipcRenderer.invoke(IPC.READ_LOG, logPath),
  listBranches: (
    repo: string,
    defaultBranch?: string,
  ): Promise<BranchListResult> =>
    ipcRenderer.invoke(IPC.LIST_BRANCHES, repo, defaultBranch),
  scaffoldWorkflow: (
    id: string,
    branch: string,
    description: string,
  ): Promise<OpenResult> =>
    ipcRenderer.invoke(IPC.SCAFFOLD_WORKFLOW, id, branch, description),
  writeActivityLog: (entry: ActivityEntry): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC.WRITE_ACTIVITY_LOG, entry),
  onRegistryUpdated: (cb: (reg: Registry) => void): (() => void) => {
    const handler = (_: unknown, reg: Registry) => cb(reg);
    ipcRenderer.on(IPC.REGISTRY_UPDATED, handler);
    return () => ipcRenderer.removeListener(IPC.REGISTRY_UPDATED, handler);
  },
  transcribeAudio: (audioBuffer: ArrayBuffer): Promise<string> =>
    ipcRenderer.invoke(IPC.TRANSCRIBE_AUDIO, audioBuffer),
  copyToClipboard: (text: string): Promise<void> =>
    ipcRenderer.invoke(IPC.COPY_TO_CLIPBOARD, text),
  getTranscriptionLog: (): Promise<TranscriptionEntry[]> =>
    ipcRenderer.invoke(IPC.GET_TRANSCRIPTION_LOG),
  saveTranscription: (text: string): Promise<TranscriptionEntry> =>
    ipcRenderer.invoke(IPC.SAVE_TRANSCRIPTION, text),
  readingListImport: (): Promise<ReadingListImportResult> =>
    ipcRenderer.invoke(IPC.READING_LIST_IMPORT),
  readingListAddUrl: (url: string): Promise<ReadingListAddResult> =>
    ipcRenderer.invoke(IPC.READING_LIST_ADD_URL, url),
  readingListGetEntries: (limit?: number): Promise<ReadingListEntry[]> =>
    ipcRenderer.invoke(IPC.READING_LIST_GET_ENTRIES, limit),
  execOsascript: (
    script: string,
  ): Promise<{ success: boolean; output: string; error?: string }> =>
    ipcRenderer.invoke(IPC.EXEC_OSASCRIPT, script),
  readClipboardImage: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC.READ_CLIPBOARD_IMAGE),
  generateCalendarScript: (
    text: string,
    imageDataUrl: string | null,
    today: string,
  ): Promise<{ success: boolean; script: string; error?: string }> =>
    ipcRenderer.invoke(IPC.GENERATE_CALENDAR_SCRIPT, text, imageDataUrl, today),
});
