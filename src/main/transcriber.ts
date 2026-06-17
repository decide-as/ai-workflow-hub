import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import type { TranscriptionEntry } from '../../shared/types'

const LOG_PATH = join(app.getPath('userData'), 'transcription-log.json')
const TTL_MS = 24 * 60 * 60 * 1000

function readLog(): TranscriptionEntry[] {
  if (!existsSync(LOG_PATH)) return []
  try {
    return JSON.parse(readFileSync(LOG_PATH, 'utf8')) as TranscriptionEntry[]
  } catch {
    return []
  }
}

function writeLog(entries: TranscriptionEntry[]): void {
  writeFileSync(LOG_PATH, JSON.stringify(entries, null, 2), 'utf8')
}

export function getTranscriptionLog(): TranscriptionEntry[] {
  const cutoff = Date.now() - TTL_MS
  const entries = readLog().filter((e) => new Date(e.timestamp).getTime() > cutoff)
  // Persist the pruned list so the file stays clean
  writeLog(entries)
  return entries.slice().reverse() // newest first
}

export function saveTranscription(text: string): TranscriptionEntry {
  const entry: TranscriptionEntry = {
    id: randomUUID(),
    text,
    timestamp: new Date().toISOString(),
  }
  const cutoff = Date.now() - TTL_MS
  const existing = readLog().filter((e) => new Date(e.timestamp).getTime() > cutoff)
  writeLog([...existing, entry])
  return entry
}

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set in the environment')

  // Write audio to a temp file so we can send it as multipart form-data
  const tmpPath = join(tmpdir(), `wh-transcription-${Date.now()}.webm`)
  writeFileSync(tmpPath, audioBuffer)

  try {
    const boundary = `----FormBoundary${randomUUID().replace(/-/g, '')}`
    const filename = 'audio.webm'
    const mimeType = 'audio/webm'

    const preamble = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: ${mimeType}\r\n\r\n`,
      'utf8',
    )
    const modelPart = Buffer.from(
      `\r\n--${boundary}\r\n` +
        `Content-Disposition: form-data; name="model"\r\n\r\n` +
        `gpt-4o-transcribe` +
        `\r\n--${boundary}\r\n` +
        `Content-Disposition: form-data; name="language"\r\n\r\n` +
        `en` +
        `\r\n--${boundary}--\r\n`,
      'utf8',
    )

    const body = Buffer.concat([preamble, audioBuffer, modelPart])

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    })

    if (!res.ok) {
      const err = await res.text().catch(() => String(res.status))
      throw new Error(`OpenAI API error (${res.status}): ${err}`)
    }

    const json = (await res.json()) as { text?: string }
    const text = json.text?.trim() ?? ''
    if (!text) throw new Error('Empty transcription returned')
    return text
  } finally {
    try {
      const { unlinkSync } = await import('fs')
      unlinkSync(tmpPath)
    } catch {
      // best-effort cleanup
    }
  }
}
