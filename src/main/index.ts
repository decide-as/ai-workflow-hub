import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { isAbsolute, join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { getRegistry, watchRegistry, getRegistryPath, getBaseDir } from './registry'
import { openInTerminal } from './terminal'
import { pickFolder, runScript } from './runner'
import { IPC } from '../../shared/ipc-channels'
import type { RunResult } from '../../shared/types'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'sidebar',
    backgroundColor: '#09090b',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
    },
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('as.decide.ai-workflow-hub')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  ipcMain.handle(IPC.GET_REGISTRY, () => getRegistry())
  ipcMain.handle(IPC.OPEN_WORKFLOW, (_, id: string) => {
    const reg = getRegistry()
    const workflow = reg.workflows.find((w) => w.id === id)
    if (!workflow) return { success: false, error: 'Workflow not found' }
    // repo_path may be absolute, or relative to the app root (for bundled workflows).
    const repoPath = isAbsolute(workflow.repo_path)
      ? workflow.repo_path
      : join(getBaseDir(), workflow.repo_path)
    return openInTerminal(repoPath)
  })

  ipcMain.handle(IPC.PICK_FOLDER, (_, prompt?: string) => pickFolder(mainWindow, prompt))

  // Open a folder in Finder. Returns '' on success or an error string.
  ipcMain.handle(IPC.REVEAL_PATH, (_, target: string) => shell.openPath(target))

  ipcMain.handle(
    IPC.RUN_WORKFLOW,
    (_, id: string, folder: string, apply: boolean): RunResult => {
      const reg = getRegistry()
      const workflow = reg.workflows.find((w) => w.id === id)
      if (!workflow) {
        return { success: false, output: '', error: 'Workflow not found', errorKind: 'unknown' }
      }
      if (workflow.action !== 'run' || !workflow.runner) {
        return {
          success: false,
          output: '',
          error: 'This workflow is not runnable.',
          errorKind: 'not-runnable',
        }
      }
      const repoPath = isAbsolute(workflow.repo_path)
        ? workflow.repo_path
        : join(getBaseDir(), workflow.repo_path)
      return runScript(repoPath, workflow.runner, folder, apply)
    },
  )

  watchRegistry(getRegistryPath(), (reg) => {
    mainWindow?.webContents.send(IPC.REGISTRY_UPDATED, reg)
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
