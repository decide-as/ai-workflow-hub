import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import yaml from 'js-yaml'
import chokidar from 'chokidar'
import type { Registry } from '../../shared/types'

const EMPTY: Registry = { workflows: [], clusters: [] }

export function getRegistryPath(): string {
  if (process.env.AI_HUB_REGISTRY) return process.env.AI_HUB_REGISTRY
  return join(app.getAppPath(), 'registry', 'workflows.yaml')
}

let cache: Registry = EMPTY

export function getRegistry(): Registry {
  const path = getRegistryPath()
  if (!existsSync(path)) return EMPTY
  try {
    cache = (yaml.load(readFileSync(path, 'utf-8')) as Registry) ?? EMPTY
    return cache
  } catch {
    return cache
  }
}

export function watchRegistry(path: string, onChange: (reg: Registry) => void): void {
  chokidar.watch(path, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 200 } })
    .on('change', () => {
      try {
        const reg = (yaml.load(readFileSync(path, 'utf-8')) as Registry) ?? EMPTY
        cache = reg
        onChange(reg)
      } catch {
        // silently ignore parse errors during live reload
      }
    })
}
