import { config as dotenvConfig } from "dotenv";
import { execSync } from "child_process";
import { resolve, dirname } from "path";

// Load .env from the main repo root. Works from both the main checkout and any
// worktree because --git-common-dir always returns the shared .git directory.
try {
  const raw = execSync("git rev-parse --git-common-dir", {
    encoding: "utf8",
  }).trim();
  dotenvConfig({ path: resolve(dirname(resolve(raw)), ".env") });
} catch {
  // Packaged app or outside git — fall back to the existing process.env.
}

import { app, BrowserWindow, shell, ipcMain, clipboard } from "electron";
import { isAbsolute, join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import {
  getRegistry,
  watchRegistry,
  getRegistryPath,
  getBaseDir,
  mergeRegistryWithMachineConfig,
} from "./registry";
import {
  readMachineConfig,
  writeMachineConfig,
  watchMachineConfig,
} from "./machine-config";
import { openInTerminal } from "./terminal";
import { pickFolder, runScript } from "./runner";
import {
  getScheduleStatus,
  enableSchedule,
  disableSchedule,
  readLog,
} from "./schedule";
import { listBranches, scaffoldWorkflow } from "./scaffolder";
import { writeActivityLog, type ActivityEntry } from "./logger";
import {
  transcribeAudio,
  getTranscriptionLog,
  saveTranscription,
} from "./transcriber";
import {
  importFromReminders,
  addUrl as readingListAddUrl,
  getEntries as readingListGetEntries,
} from "./reading-list";
import {
  execOsascript,
  readClipboardImage,
  generateCalendarScript,
} from "./calendar";
import { getLoanStakeholders, generateLoanAgreement } from "./loan";
import { createPurchase as fikenCreatePurchase } from "./fiken";
import {
  getTransactions as loanInterestGetTransactions,
  saveTransaction as loanInterestSaveTransaction,
  deleteTransaction as loanInterestDeleteTransaction,
  calculateInterest as loanInterestCalculate,
} from "./loanInterest";
import { createVoucherFolders } from "./bookkeeping";
import { warmupEmbeddings, semanticSearch } from "./embeddings";
import { analyzeImage, checkOllamaAvailable } from "./vision";
import { clusterImages } from "./image-clustering";
import { scanAndPlan, applyPlan } from "./image-organizer";
import { IPC } from "../../shared/ipc-channels";
import type {
  RunResult,
  ScheduleStatus,
  Workflow,
  MachineConfig,
  VisionResult,
  OrganizerPlan,
  FikenCreatePurchaseArgs,
} from "../../shared/types";

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: "hiddenInset",
    vibrancy: "sidebar",
    backgroundColor: "#09090b",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
    },
  });

  mainWindow.on("ready-to-show", () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId("as.decide.workflow-hub");
  app.on("browser-window-created", (_, window) =>
    optimizer.watchWindowShortcuts(window),
  );

  ipcMain.handle(IPC.GET_REGISTRY, () =>
    mergeRegistryWithMachineConfig(getRegistry(), readMachineConfig()),
  );
  ipcMain.handle(IPC.GET_REGISTRY_ALL, () => getRegistry());
  ipcMain.handle(IPC.MACHINE_CONFIG_GET, () => readMachineConfig());
  ipcMain.handle(
    IPC.MACHINE_CONFIG_SET,
    (_event, config: MachineConfig): { success: boolean; error?: string } => {
      try {
        writeMachineConfig(config);
        return { success: true };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  );
  ipcMain.handle(IPC.OPEN_WORKFLOW, (_, id: string, initialPrompt?: string) => {
    const reg = getRegistry();
    const workflow = reg.workflows.find((w) => w.id === id);
    if (!workflow) return { success: false, error: "Workflow not found" };
    // repo_path may be absolute, or relative to the app root (for bundled workflows).
    const repoPath = isAbsolute(workflow.repo_path)
      ? workflow.repo_path
      : join(getBaseDir(), workflow.repo_path);
    const result = openInTerminal(repoPath, initialPrompt);
    writeActivityLog({
      timestamp: new Date().toISOString(),
      workflow_id: workflow.id,
      workflow_name: workflow.name,
      action: "claude",
      success: result.success,
      error: result.error,
    });
    return result;
  });

  ipcMain.handle(IPC.PICK_FOLDER, (_, prompt?: string, defaultPath?: string) =>
    pickFolder(mainWindow, prompt, defaultPath),
  );

  // Open a folder in Finder. Returns '' on success or an error string.
  ipcMain.handle(IPC.REVEAL_PATH, (_, target: string) =>
    shell.openPath(target),
  );

  const withWorkflow = (
    id: string,
    fn: (w: Workflow) => ScheduleStatus,
  ): ScheduleStatus => {
    const workflow = getRegistry().workflows.find((w) => w.id === id);
    if (!workflow)
      return { installed: false, loaded: false, error: "Workflow not found" };
    return fn(workflow);
  };

  ipcMain.handle(IPC.SCHEDULE_STATUS, (_, id: string) =>
    withWorkflow(id, getScheduleStatus),
  );
  ipcMain.handle(IPC.SCHEDULE_ENABLE, (_, id: string) =>
    withWorkflow(id, enableSchedule),
  );
  ipcMain.handle(IPC.SCHEDULE_DISABLE, (_, id: string) =>
    withWorkflow(id, disableSchedule),
  );

  ipcMain.handle(IPC.READ_LOG, (_, logPath: string) => readLog(logPath));

  ipcMain.handle(
    IPC.RUN_WORKFLOW,
    (
      _,
      id: string,
      folder: string,
      apply: boolean,
      extraArgs: string[] = [],
    ): RunResult => {
      const reg = getRegistry();
      const workflow = reg.workflows.find((w) => w.id === id);
      if (!workflow) {
        return {
          success: false,
          output: "",
          error: "Workflow not found",
          errorKind: "unknown",
        };
      }
      if (workflow.action !== "run" || !workflow.runner) {
        return {
          success: false,
          output: "",
          error: "This workflow is not runnable.",
          errorKind: "not-runnable",
        };
      }
      const repoPath = isAbsolute(workflow.repo_path)
        ? workflow.repo_path
        : join(getBaseDir(), workflow.repo_path);
      return runScript(repoPath, workflow.runner, folder, apply, extraArgs);
    },
  );

  ipcMain.handle(IPC.LIST_BRANCHES, (_, repo: string, defaultBranch?: string) =>
    listBranches(repo, defaultBranch),
  );

  ipcMain.handle(
    IPC.SCAFFOLD_WORKFLOW,
    (_, id: string, branch: string, description: string) => {
      const workflow = getRegistry().workflows.find((w) => w.id === id);
      if (!workflow)
        return {
          success: false,
          error: "Workflow not found",
          errorKind: "unknown",
        };
      const result = scaffoldWorkflow(workflow, branch, description);
      writeActivityLog({
        timestamp: new Date().toISOString(),
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        action: "scaffold",
        branch,
        description,
        success: result.success,
        error: result.error,
      });
      return result;
    },
  );

  ipcMain.handle(IPC.WRITE_ACTIVITY_LOG, (_, entry: ActivityEntry) => {
    writeActivityLog(entry);
    return { success: true };
  });

  ipcMain.handle(IPC.COPY_TO_CLIPBOARD, (_, text: string) => {
    clipboard.writeText(text);
  });

  ipcMain.handle(IPC.GET_TRANSCRIPTION_LOG, () => getTranscriptionLog());

  ipcMain.handle(IPC.SAVE_TRANSCRIPTION, (_, text: string) =>
    saveTranscription(text),
  );

  ipcMain.handle(IPC.TRANSCRIBE_AUDIO, async (_, audioData: ArrayBuffer) => {
    const buf = Buffer.from(audioData);
    return transcribeAudio(buf);
  });

  ipcMain.handle(IPC.READING_LIST_IMPORT, () =>
    importFromReminders(getBaseDir()),
  );

  ipcMain.handle(IPC.READING_LIST_ADD_URL, (_, url: string) =>
    readingListAddUrl(getBaseDir(), url),
  );

  ipcMain.handle(IPC.READING_LIST_GET_ENTRIES, (_, limit?: number) =>
    readingListGetEntries(getBaseDir(), limit),
  );

  ipcMain.handle(IPC.EXEC_OSASCRIPT, (_, script: string) =>
    execOsascript(script),
  );

  ipcMain.handle(IPC.READ_CLIPBOARD_IMAGE, () => readClipboardImage());

  ipcMain.handle(
    IPC.GENERATE_CALENDAR_SCRIPT,
    (_, text: string, imageDataUrl: string | null, today: string) =>
      generateCalendarScript(text, imageDataUrl, today),
  );

  ipcMain.handle(IPC.LOAN_GET_STAKEHOLDERS, () => getLoanStakeholders());

  ipcMain.handle(IPC.LOAN_GENERATE, (_, data) => generateLoanAgreement(data));

  ipcMain.handle(IPC.LOAN_INTEREST_GET_TRANSACTIONS, (_, lender, borrower) =>
    loanInterestGetTransactions(lender, borrower),
  );
  ipcMain.handle(IPC.LOAN_INTEREST_SAVE_TRANSACTION, (_, tx) =>
    loanInterestSaveTransaction(tx),
  );
  ipcMain.handle(IPC.LOAN_INTEREST_DELETE_TRANSACTION, (_, id) =>
    loanInterestDeleteTransaction(id),
  );
  ipcMain.handle(IPC.LOAN_INTEREST_CALCULATE, (_, lender, borrower, toDate) =>
    loanInterestCalculate(lender, borrower, toDate),
  );

  ipcMain.handle(
    IPC.CREATE_VOUCHER_FOLDERS,
    (_, files: Array<{ name: string; dataUrl: string }>, outputDir: string) =>
      createVoucherFolders(files, outputDir),
  );

  ipcMain.handle(IPC.SEMANTIC_SEARCH, (_, query: string) =>
    semanticSearch(query, getRegistry().workflows),
  );

  ipcMain.handle(IPC.VISION_CHECK, () => checkOllamaAvailable());

  ipcMain.handle(IPC.VISION_ANALYZE, (_, imagePath: string) =>
    analyzeImage(imagePath),
  );

  ipcMain.handle(
    IPC.VISION_CLUSTER,
    (_, images: VisionResult[], opts?: { maxClusters?: number }) =>
      clusterImages(images, opts),
  );

  ipcMain.handle(IPC.ORGANIZER_SCAN, (_, sourceFolder: string) =>
    scanAndPlan(sourceFolder, (progress) => {
      mainWindow?.webContents.send(IPC.ORGANIZER_PROGRESS, progress);
    }),
  );

  ipcMain.handle(
    IPC.ORGANIZER_APPLY,
    (_, plan: OrganizerPlan, dryRun: boolean) => applyPlan(plan, dryRun),
  );

  ipcMain.handle(
    IPC.FIKEN_CREATE_PURCHASE,
    (_, args: FikenCreatePurchaseArgs) => fikenCreatePurchase(args),
  );

  watchRegistry(getRegistryPath(), (reg) => {
    const merged = mergeRegistryWithMachineConfig(reg, readMachineConfig());
    mainWindow?.webContents.send(IPC.REGISTRY_UPDATED, merged);
  });

  watchMachineConfig(() => {
    const merged = mergeRegistryWithMachineConfig(
      getRegistry(),
      readMachineConfig(),
    );
    mainWindow?.webContents.send(IPC.REGISTRY_UPDATED, merged);
  });

  createWindow();
  // Warm up the embedding model in the background so the first query is fast
  setTimeout(() => warmupEmbeddings(getRegistry().workflows), 3000);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
