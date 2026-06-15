import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import yaml from 'js-yaml'
import type { Registry } from '../shared/types'

// Test CLI logic by exercising it directly (without spawning a subprocess)
// We replicate the read/write helpers to test the register flow in isolation.

function emptyRegistry(): Registry {
  return { workflows: [], clusters: [] }
}

function writeRegistry(path: string, reg: Registry): void {
  const tmp = path + '.tmp'
  writeFileSync(tmp, yaml.dump(reg, { lineWidth: 120 }), 'utf-8')
  require('fs').renameSync(tmp, path)
}

function readRegistry(path: string): Registry {
  if (!existsSync(path)) return emptyRegistry()
  return (yaml.load(readFileSync(path, 'utf-8')) as Registry) ?? emptyRegistry()
}

describe('CLI register logic', () => {
  let tmpDir: string
  let registryPath: string

  beforeEach(() => {
    tmpDir = join(tmpdir(), `ai-hub-cli-test-${Date.now()}`)
    mkdirSync(tmpDir, { recursive: true })
    registryPath = join(tmpDir, 'workflows.yaml')
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates registry file on first register', () => {
    const reg = emptyRegistry()
    reg.workflows.push({
      id: 'test-id-1',
      name: 'My Workflow',
      description: 'Does things',
      tags: ['finance'],
      repo_path: tmpDir,
      color: '#6366f1',
      icon: 'Bot',
      cluster_id: null,
      added: '2026-06-15',
      updated: '2026-06-15',
    })
    writeRegistry(registryPath, reg)
    expect(existsSync(registryPath)).toBe(true)
    const loaded = readRegistry(registryPath)
    expect(loaded.workflows).toHaveLength(1)
    expect(loaded.workflows[0].name).toBe('My Workflow')
  })

  it('appends a second workflow without overwriting the first', () => {
    const reg = emptyRegistry()
    reg.workflows.push({
      id: 'id-1',
      name: 'First',
      description: '',
      tags: ['ops'],
      repo_path: tmpDir,
      color: '#fff',
      icon: 'Bot',
      cluster_id: null,
      added: '2026-01-01',
      updated: '2026-01-01',
    })
    writeRegistry(registryPath, reg)

    const reg2 = readRegistry(registryPath)
    reg2.workflows.push({
      id: 'id-2',
      name: 'Second',
      description: '',
      tags: ['ops'],
      repo_path: tmpDir,
      color: '#fff',
      icon: 'Bot',
      cluster_id: null,
      added: '2026-01-02',
      updated: '2026-01-02',
    })
    writeRegistry(registryPath, reg2)

    const final = readRegistry(registryPath)
    expect(final.workflows).toHaveLength(2)
    expect(final.workflows.map((w) => w.name)).toContain('First')
    expect(final.workflows.map((w) => w.name)).toContain('Second')
  })

  it('tags are stored and retrieved as an array', () => {
    const reg = emptyRegistry()
    reg.workflows.push({
      id: 'tag-test',
      name: 'Tag Test',
      description: '',
      tags: ['finance', 'reporting', 'monthly'],
      repo_path: tmpDir,
      color: '#fff',
      icon: 'Bot',
      cluster_id: null,
      added: '2026-01-01',
      updated: '2026-01-01',
    })
    writeRegistry(registryPath, reg)
    const loaded = readRegistry(registryPath)
    expect(loaded.workflows[0].tags).toEqual(['finance', 'reporting', 'monthly'])
  })

  it('atomic write (tmp + rename) leaves no .tmp file', () => {
    writeRegistry(registryPath, emptyRegistry())
    expect(existsSync(registryPath + '.tmp')).toBe(false)
    expect(existsSync(registryPath)).toBe(true)
  })
})
