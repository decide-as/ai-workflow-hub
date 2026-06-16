import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import type { Registry, OpenResult, RunResult } from '../../shared/types'

contextBridge.exposeInMainWorld('api', {
  getRegistry: (): Promise<Registry> => ipcRenderer.invoke(IPC.GET_REGISTRY),
  openWorkflow: (id: string): Promise<OpenResult> => ipcRenderer.invoke(IPC.OPEN_WORKFLOW, id),
  pickFolder: (prompt?: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.PICK_FOLDER, prompt),
  runWorkflow: (id: string, folder: string, apply: boolean): Promise<RunResult> =>
    ipcRenderer.invoke(IPC.RUN_WORKFLOW, id, folder, apply),
  revealPath: (target: string): Promise<string> => ipcRenderer.invoke(IPC.REVEAL_PATH, target),
  onRegistryUpdated: (cb: (reg: Registry) => void): (() => void) => {
    const handler = (_: unknown, reg: Registry) => cb(reg)
    ipcRenderer.on(IPC.REGISTRY_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC.REGISTRY_UPDATED, handler)
  },
})
