import { readFileSync } from "fs";
import { extname } from "path";
import type { VisionResult } from "../../shared/types";

const OLLAMA_BASE = "http://localhost:11434";
const MODEL = "qwen3-vl:8b";

const PROMPT = `Analyze this image and respond with ONLY valid JSON in this exact format:
{
  "description": "A concise 1-2 sentence description of what this image shows",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}

Rules:
- description: plain text, no markdown
- keywords: 4-8 lowercase single words or short phrases that best categorize this image
- respond with JSON only, no other text`;

function toBase64(imagePath: string): string {
  const buf = readFileSync(imagePath);
  return buf.toString("base64");
}

function mimeType(imagePath: string): string {
  const ext = extname(imagePath).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  return map[ext] ?? "image/png";
}

export async function checkOllamaAvailable(): Promise<{
  running: boolean;
  modelReady: boolean;
  pullCommand?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok)
      return {
        running: false,
        modelReady: false,
        error: "Ollama not responding",
      };
    const data = (await res.json()) as { models: Array<{ name: string }> };
    const modelReady = data.models.some((m) => m.name.startsWith("qwen3-vl"));
    return {
      running: true,
      modelReady,
      pullCommand: modelReady ? undefined : `ollama pull ${MODEL}`,
    };
  } catch {
    return {
      running: false,
      modelReady: false,
      error: "Ollama is not running. Start it with: ollama serve",
    };
  }
}

function notReadyError(check: {
  running: boolean;
  modelReady: boolean;
  pullCommand?: string;
  error?: string;
}): Error {
  if (!check.running) {
    return new Error(
      check.error ?? "Ollama is not running. Start it with: ollama serve",
    );
  }
  return new Error(
    `Model not downloaded. Run once in a terminal: ${check.pullCommand ?? `ollama pull ${MODEL}`}`,
  );
}

export async function analyzeImage(imagePath: string): Promise<VisionResult> {
  const check = await checkOllamaAvailable();
  if (!check.running || !check.modelReady) throw notReadyError(check);

  const base64 = toBase64(imagePath);

  const body = {
    model: MODEL,
    prompt: PROMPT,
    images: [base64],
    stream: false,
    keep_alive: 0,
    options: { temperature: 0.1 },
  };

  let res: Response;
  try {
    res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    throw new Error(`Ollama not reachable: ${e}`);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { response: string };
  const raw = data.response.trim();

  // Strip markdown code fences if the model adds them
  const json = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: { description: string; keywords: string[] };
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(`Model returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  return {
    description: parsed.description ?? "",
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    model: MODEL,
    imagePath,
    mimeType: mimeType(imagePath),
  };
}
