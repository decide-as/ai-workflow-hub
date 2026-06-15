import { execSync, spawnSync } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { OpenResult } from '../../shared/types'

function escapePath(p: string): string {
  return p.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function itunesRunning(): boolean {
  try {
    const out = execSync('pgrep -x iTerm2', { stdio: ['ignore', 'pipe', 'ignore'] }).toString()
    return out.trim().length > 0
  } catch {
    return false
  }
}

export function openInTerminal(repoPath: string): OpenResult {
  const escaped = escapePath(repoPath)
  const useITerm = itunesRunning()

  const script = useITerm
    ? `
tell application "iTerm2"
  create window with default profile
  tell current session of current window
    write text "cd \\"${escaped}\\" && claude"
  end tell
end tell`
    : `
tell application "Terminal"
  do script "cd \\"${escaped}\\" && claude"
  activate
end tell`

  const tmpScript = join(tmpdir(), `ai-hub-${Date.now()}.scpt`)
  try {
    writeFileSync(tmpScript, script, 'utf-8')
    const result = spawnSync('osascript', [tmpScript], { encoding: 'utf-8' })
    if (result.status !== 0) {
      return { success: false, error: result.stderr?.trim() || 'osascript failed' }
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  } finally {
    try { unlinkSync(tmpScript) } catch { /* ignore */ }
  }
}
