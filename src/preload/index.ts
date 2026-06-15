import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import type { Registry, OpenResult } from '../../shared/types'

contextBridge.exposeInMainWorld('api', {
  getRegistry: (): Promise<Registry> => ipcRenderer.invoke(IPC.GET_REGISTRY),
  openWorkflow: (id: string): Promise<OpenResult> => ipcRenderer.invoke(IPC.OPEN_WORKFLOW, id),
  onRegistryUpdated: (cb: (reg: Registry) => void): (() => void) => {
    const handler = (_: unknown, reg: Registry) => cb(reg)
    ipcRenderer.on(IPC.REGISTRY_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC.REGISTRY_UPDATED, handler)
  },
})
