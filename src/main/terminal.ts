import { execSync, spawnSync } from 'child_process'
import { existsSync, writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { OpenResult, OpenErrorKind } from '../../shared/types'

function escapePath(p: string): string {
  return p.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function isIterm2Running(): boolean {
  try {
    const out = execSync('pgrep -x iTerm2', { stdio: ['ignore', 'pipe', 'ignore'] }).toString()
    return out.trim().length > 0
  } catch {
    return false
  }
}

export function findClaudeBin(): string | null {
  try {
    const out = execSync('which claude', { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf-8' })
    const p = out.trim()
    return p.length > 0 ? p : null
  } catch {
    return null
  }
}

function classifyError(stderr: string): { error: string; errorKind: OpenErrorKind } {
  const s = stderr.toLowerCase()
  if (s.includes('not authorized') || s.includes('authorization') || s.includes('is not allowed')) {
    return {
      error: 'Automation permission required — open System Settings › Privacy & Security › Automation and allow Terminal.',
      errorKind: 'permission',
    }
  }
  return { error: stderr || 'osascript failed', errorKind: 'unknown' }
}

export function openInTerminal(repoPath: string): OpenResult {
  if (!existsSync(repoPath)) {
    return { success: false, error: `Repo path not found: ${repoPath}`, errorKind: 'path-missing' }
  }

  if (!findClaudeBin()) {
    return {
      success: false,
      error: 'claude not found in PATH — install from claude.ai/download',
      errorKind: 'claude-missing',
    }
  }

  const escaped = escapePath(repoPath)
  const useITerm = isIterm2Running()

  const script = useITerm
    ? `tell application "iTerm2"
  create window with default profile
  tell current session of current window
    write text "cd \\"${escaped}\\" && claude"
  end tell
end tell`
    : `tell application "Terminal"
  do script "cd \\"${escaped}\\" && claude"
  activate
end tell`

  const tmpScript = join(tmpdir(), `ai-hub-${Date.now()}.scpt`)
  try {
    writeFileSync(tmpScript, script, 'utf-8')
    const result = spawnSync('osascript', [tmpScript], { encoding: 'utf-8' })
    if (result.status !== 0) {
      const { error, errorKind } = classifyError(result.stderr?.trim() ?? '')
      return { success: false, error, errorKind }
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err), errorKind: 'unknown' }
  } finally {
    try { unlinkSync(tmpScript) } catch { /* ignore */ }
  }
}
