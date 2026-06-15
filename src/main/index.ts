import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { getRegistry, watchRegistry, getRegistryPath } from './registry'
import { openInTerminal } from './terminal'
import { IPC } from '../../shared/ipc-channels'

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
    return openInTerminal(workflow.repo_path)
  })

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
