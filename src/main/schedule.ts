import { spawnSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { isAbsolute, join } from 'path'
import { getBaseDir } from './registry'
import type { Workflow, ScheduleStatus } from '../../shared/types'

const NO_JOB: ScheduleStatus = {
  installed: false,
  loaded: false,
  error: 'No scheduled job configured for this workflow.',
}

function repoFor(workflow: Workflow): string {
  return isAbsolute(workflow.repo_path)
    ? workflow.repo_path
    : join(getBaseDir(), workflow.repo_path)
}

function scheduleScript(workflow: Workflow): string {
  return join(repoFor(workflow), 'scripts', 'schedule.sh')
}

// The registry's scheduled_job is the single config source — feed it to
// schedule.sh as env so display and execution can never drift.
function jobEnv(workflow: Workflow): NodeJS.ProcessEnv {
  const job = workflow.scheduled_job
  return {
    ...process.env,
    FO_TARGET: job?.target ?? '~/Downloads',
    FO_INTERVAL: String(job?.interval_seconds ?? 3600),
    FO_MIN_AGE_DAYS: String(job?.min_age_days ?? 0),
    FO_LABEL: job?.label ?? 'as.decide.workflow-hub.file-organizer',
  }
}

// Parse the last line of schedule.sh output as the status JSON.
export function parseStatusJson(stdout: string): ScheduleStatus {
  try {
    const line = stdout.trim().split('\n').pop() || '{}'
    const j = JSON.parse(line)
    return {
      installed: !!j.installed,
      loaded: !!j.loaded,
      lastRunAt: j.lastRunAt ?? null,
      lastExitCode: null,
      logPath: j.logPath ?? null,
    }
  } catch {
    return { installed: false, loaded: false, error: 'Could not read schedule status.' }
  }
}

// Read the launchd log file for a scheduled workflow. Returns '' if not found.
export function readLog(logPath: string): string {
  try {
    if (!logPath || !existsSync(logPath)) return ''
    return readFileSync(logPath, 'utf-8')
  } catch {
    return ''
  }
}

function run(workflow: Workflow, cmd: 'enable' | 'disable' | 'status') {
  return spawnSync('bash', [scheduleScript(workflow), cmd], {
    encoding: 'utf-8',
    env: jobEnv(workflow),
  })
}

export function getScheduleStatus(workflow: Workflow): ScheduleStatus {
  if (!workflow.scheduled_job) return NO_JOB
  const res = run(workflow, 'status')
  if (res.error) return { installed: false, loaded: false, error: String(res.error.message) }
  if (res.status !== 0) {
    return { installed: false, loaded: false, error: res.stderr?.trim() || 'Status check failed.' }
  }
  return parseStatusJson(res.stdout ?? '')
}

export function enableSchedule(workflow: Workflow): ScheduleStatus {
  if (!workflow.scheduled_job) return NO_JOB
  const res = run(workflow, 'enable')
  if (res.status !== 0) {
    return { installed: false, loaded: false, error: res.stderr?.trim() || 'Failed to enable schedule.' }
  }
  return getScheduleStatus(workflow)
}

export function disableSchedule(workflow: Workflow): ScheduleStatus {
  if (!workflow.scheduled_job) return NO_JOB
  const res = run(workflow, 'disable')
  if (res.status !== 0) {
    return { installed: false, loaded: false, error: res.stderr?.trim() || 'Failed to disable schedule.' }
  }
  return getScheduleStatus(workflow)
}
