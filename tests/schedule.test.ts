import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({ app: { getAppPath: () => '/base' } }))

vi.mock('child_process', () => ({ spawnSync: vi.fn() }))

import { spawnSync } from 'child_process'
import { parseStatusJson, getScheduleStatus, enableSchedule, disableSchedule } from '../src/main/schedule'
import type { Workflow } from '../shared/types'

const mockSpawn = vi.mocked(spawnSync)

const WF = {
  id: 'x',
  name: 'File Organizer',
  description: '',
  tags: [],
  repo_path: 'workflows/file-organizer',
  color: '#000',
  icon: 'FolderTree',
  cluster_id: 'utilities',
  added: '2026-06-17',
  updated: '2026-06-17',
  scheduled_job: {
    label: 'as.decide.workflow-hub.file-organizer',
    target: '~/Downloads',
    cadence: 'Every hour',
    interval_seconds: 3600,
    min_age_days: 7,
  },
} as Workflow

const NO_JOB = { ...WF, scheduled_job: undefined } as Workflow

function spawnOut(status: number, stdout = '', stderr = '') {
  return { status, stdout, stderr, pid: 1, output: [], signal: null } as ReturnType<typeof spawnSync>
}

const STATUS_JSON =
  '{"installed":true,"loaded":true,"lastRunAt":"2026-06-17T09:00:00","target":"/Users/me/Downloads"}'

beforeEach(() => {
  vi.clearAllMocks()
  mockSpawn.mockReturnValue(spawnOut(0, STATUS_JSON))
})

describe('parseStatusJson()', () => {
  it('maps the JSON status fields', () => {
    const s = parseStatusJson(STATUS_JSON)
    expect(s).toMatchObject({ installed: true, loaded: true, lastRunAt: '2026-06-17T09:00:00' })
  })

  it('reads the last line when other output precedes the JSON', () => {
    const s = parseStatusJson(`enabled foo\n${STATUS_JSON}`)
    expect(s.loaded).toBe(true)
  })

  it('returns an error status on malformed output', () => {
    const s = parseStatusJson('not json')
    expect(s.loaded).toBe(false)
    expect(s.error).toBeTruthy()
  })
})

describe('schedule commands', () => {
  it('getScheduleStatus runs the status subcommand and parses output', () => {
    const s = getScheduleStatus(WF)
    const [bin, args] = mockSpawn.mock.calls[0]
    expect(bin).toBe('bash')
    expect(args[0]).toContain('workflows/file-organizer/scripts/schedule.sh')
    expect(args[1]).toBe('status')
    expect(s.loaded).toBe(true)
  })

  it('enableSchedule invokes the enable subcommand', () => {
    enableSchedule(WF)
    expect(mockSpawn.mock.calls[0][1][1]).toBe('enable')
  })

  it('disableSchedule invokes the disable subcommand', () => {
    disableSchedule(WF)
    expect(mockSpawn.mock.calls[0][1][1]).toBe('disable')
  })

  it('passes the job config to schedule.sh as env vars', () => {
    getScheduleStatus(WF)
    const env = mockSpawn.mock.calls[0][2]?.env as NodeJS.ProcessEnv
    expect(env.FO_LABEL).toBe('as.decide.workflow-hub.file-organizer')
    expect(env.FO_INTERVAL).toBe('3600')
    expect(env.FO_MIN_AGE_DAYS).toBe('7')
  })

  it('short-circuits when no scheduled job is configured', () => {
    const s = getScheduleStatus(NO_JOB)
    expect(s.error).toMatch(/no scheduled job/i)
    expect(mockSpawn).not.toHaveBeenCalled()
  })

  it('surfaces a non-zero exit as an error status', () => {
    mockSpawn.mockReturnValue(spawnOut(1, '', 'boom'))
    const s = enableSchedule(WF)
    expect(s.loaded).toBe(false)
    expect(s.error).toBe('boom')
  })
})
