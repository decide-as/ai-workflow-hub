import { execSync, spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { dialog, type BrowserWindow } from 'electron'
import type { RunResult, WorkflowRunner } from '../../shared/types'

// Cap captured script output so a pathological run can't exhaust memory.
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024 // 10 MB

export function findInterpreter(interpreter?: string): string | null {
  const candidates = interpreter ? [interpreter] : ['python3', 'python']
  for (const bin of candidates) {
    // An absolute path can be probed directly.
    if (bin.includes('/')) {
      if (existsSync(bin)) return bin
      continue
    }
    try {
      const out = execSync(`which ${bin}`, {
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf-8',
      }).trim()
      if (out.length > 0) return out
    } catch {
      // not on PATH — try the next candidate
    }
  }
  return null
}

// Opens the native folder picker. Returns the chosen absolute path, or null if
// the user cancelled.
export async function pickFolder(
  win: BrowserWindow | null,
  prompt?: string,
): Promise<string | null> {
  const options = {
    title: prompt ?? 'Choose a folder',
    buttonLabel: 'Choose folder',
    properties: ['openDirectory' as const, 'createDirectory' as const],
  }
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options)
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}

// Runs a workflow's bundled script against the chosen folder. When `apply` is
// false the script runs in its preview (dry-run) mode; when true the configured
// apply flag is appended to perform the real run.
export function runScript(
  repoPath: string,
  runner: WorkflowRunner,
  folder: string,
  apply: boolean,
): RunResult {
  const interpreter = findInterpreter(runner.interpreter)
  if (!interpreter) {
    const want = runner.interpreter ?? 'python3'
    return {
      success: false,
      output: '',
      error: `${want} not found in PATH — install it to run this workflow.`,
      errorKind: 'interpreter-missing',
    }
  }

  const scriptPath = join(repoPath, runner.script)
  if (!existsSync(scriptPath)) {
    return {
      success: false,
      output: '',
      error: `Script not found: ${scriptPath}`,
      errorKind: 'script-missing',
    }
  }

  if (!existsSync(folder)) {
    return {
      success: false,
      output: '',
      error: `Folder not found: ${folder}`,
      errorKind: 'folder-missing',
    }
  }

  const args = [scriptPath, folder]
  if (apply && runner.apply_flag) args.push(runner.apply_flag)

  const result = spawnSync(interpreter, args, {
    encoding: 'utf-8',
    maxBuffer: MAX_OUTPUT_BYTES,
  })

  if (result.error) {
    return { success: false, output: '', error: String(result.error.message), errorKind: 'unknown' }
  }

  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''
  const output = stderr ? `${stdout}${stdout ? '\n' : ''}${stderr}` : stdout

  if (result.status !== 0) {
    return {
      success: false,
      output,
      error: stderr.trim() || `Script exited with code ${result.status}`,
      errorKind: 'unknown',
    }
  }

  return { success: true, output }
}
