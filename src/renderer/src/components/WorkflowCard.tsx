import { useEffect, useRef, useState } from "react";
import {
  Copy,
  Check,
  Square,
  Mic,
  Loader2,
  RefreshCw,
  Plus,
} from "lucide-react";
import type { Workflow } from "../../../../shared/types";
import { TagBadge } from "./TagBadge";
import { SchedulePanel } from "./SchedulePanel";
import { resolveIcon } from "../lib/icons";

interface Props {
  workflow: Workflow;
  clusterName?: string;
  clusterColor?: string;
  onOpen: (id: string, initialPrompt?: string) => void;
  onRun: (id: string) => void;
  onClick: (id: string) => void;
}

const MAX_SECONDS = 5 * 60;

function formatCountdown(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type RecordState = "idle" | "recording" | "transcribing";

function TranscribeControls({
  onTranscribed,
}: {
  onTranscribed?: (text: string) => void;
}) {
  const [state, setState] = useState<RecordState>("idle");
  const [remaining, setRemaining] = useState(MAX_SECONDS);
  const [lastText, setLastText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  // Auto-stop when countdown reaches zero
  useEffect(() => {
    if (state === "recording" && remaining === 0) {
      clearTimer();
      stopRecording();
    }
  }, [remaining, state]);

  async function startRecording() {
    setError(null);
    setRemaining(MAX_SECONDS);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        clearTimer();
        stream.getTracks().forEach((t) => t.stop());
        setState("transcribing");
        try {
          const blob = new Blob(chunksRef.current, {
            type: "audio/webm;codecs=opus",
          });
          const arrayBuffer = await blob.arrayBuffer();
          const text = await window.api.transcribeAudio(arrayBuffer);
          await window.api.copyToClipboard(text);
          await window.api.saveTranscription(text);
          setLastText(text);
          onTranscribed?.(text);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Transcription failed");
        } finally {
          setState("idle");
          setRemaining(MAX_SECONDS);
        }
      };
      mediaRef.current = recorder;
      recorder.start();
      setState("recording");

      timerRef.current = setInterval(() => {
        setRemaining((prev) => Math.max(0, prev - 1));
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not access microphone",
      );
      setState("idle");
    }
  }

  function stopRecording() {
    clearTimer();
    mediaRef.current?.stop();
    mediaRef.current = null;
  }

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    if (!lastText) return;
    await window.api.copyToClipboard(lastText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleRecordClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (state === "recording") {
      stopRecording();
    } else if (state === "idle") {
      startRecording();
    }
  }

  const isRecording = state === "recording";
  const isTranscribing = state === "transcribing";
  const busy = isRecording || isTranscribing;

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-[11px] text-red-400 leading-snug">{error}</p>
      )}

      {lastText && (
        <p className="text-[11px] text-zinc-500 leading-snug line-clamp-2">
          {lastText}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleRecordClick}
          disabled={isTranscribing}
          className={[
            "flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium",
            "transition-all duration-150 border focus:outline-none focus:ring-2",
            "focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed",
            isRecording
              ? "border-red-700/60 text-red-400 bg-red-950/30 hover:bg-red-950/50"
              : "border-zinc-700/60 text-zinc-300 hover:text-zinc-100 hover:border-zinc-600 hover:bg-zinc-800/60",
          ].join(" ")}
        >
          {isTranscribing ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Transcribing…
            </>
          ) : isRecording ? (
            <>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              <Square size={13} fill="currentColor" />
              Stop
              <span className="tabular-nums text-xs font-mono px-1.5 py-0.5 rounded-md bg-red-950/60 text-red-400 border border-red-800/40">
                {formatCountdown(remaining)}
              </span>
            </>
          ) : (
            <>
              <Mic size={14} />
              Record
            </>
          )}
        </button>

        {lastText && (
          <button
            onClick={handleCopy}
            disabled={busy}
            title="Copy last transcription"
            className="w-10 h-10 flex items-center justify-center rounded-xl border border-zinc-700/60
                       text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800/60
                       transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900"
          >
            {copied ? (
              <Check size={14} className="text-emerald-400" />
            ) : (
              <Copy size={14} />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

type ImportState = "idle" | "running" | "done" | "error";
type AddState = "idle" | "running" | "done" | "error";

function ReadingListControls({ onClick }: { onClick: () => void }) {
  const [importState, setImportState] = useState<ImportState>("idle");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [addState, setAddState] = useState<AddState>("idle");
  const [addMsg, setAddMsg] = useState<string | null>(null);

  async function handleImport(e: React.MouseEvent) {
    e.stopPropagation();
    setImportState("running");
    setImportMsg(null);
    const result = await window.api.readingListImport();
    if (result.success) {
      setImportMsg(
        `+${result.imported ?? 0} new · ${result.duplicates ?? 0} dupes`,
      );
      setImportState("done");
    } else {
      setImportMsg(result.error ?? "Import failed");
      setImportState("error");
    }
    setTimeout(() => {
      setImportState("idle");
      setImportMsg(null);
    }, 4000);
  }

  async function handleAddUrl(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    const trimmed = url.trim();
    if (!trimmed) return;
    setAddState("running");
    setAddMsg(null);
    const result = await window.api.readingListAddUrl(trimmed);
    if (result.success) {
      setUrl("");
      setAddMsg("Added");
      setAddState("done");
    } else {
      setAddMsg(result.error ?? "Failed");
      setAddState("error");
    }
    setTimeout(() => {
      setAddState("idle");
      setAddMsg(null);
    }, 3000);
  }

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      {/* Import from Reminders */}
      <button
        onClick={handleImport}
        disabled={importState === "running"}
        className={[
          "w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium",
          "transition-all duration-150 border focus:outline-none focus:ring-2",
          "focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed",
          importState === "done"
            ? "border-emerald-700/60 text-emerald-400 bg-emerald-950/30"
            : importState === "error"
              ? "border-red-700/60 text-red-400 bg-red-950/30"
              : "border-zinc-700/60 text-zinc-300 hover:text-zinc-100 hover:border-zinc-600 hover:bg-zinc-800/60",
        ].join(" ")}
      >
        <RefreshCw
          size={13}
          className={importState === "running" ? "animate-spin" : ""}
        />
        {importState === "running"
          ? "Importing…"
          : (importMsg ?? "Get from Reminders")}
      </button>

      {/* Paste URL */}
      <form onSubmit={handleAddUrl} className="flex gap-1.5">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder={
            addState === "done"
              ? "Added ✓"
              : addState === "error"
                ? (addMsg ?? "Error")
                : "Paste a URL…"
          }
          disabled={addState === "running"}
          className={[
            "flex-1 rounded-xl px-3 py-2 text-xs bg-zinc-800/60 border outline-none",
            "placeholder:text-zinc-600 text-zinc-200 transition-colors",
            "focus:border-zinc-500 disabled:opacity-50",
            addState === "error"
              ? "border-red-700/60 placeholder:text-red-500"
              : addState === "done"
                ? "border-emerald-700/60 placeholder:text-emerald-500"
                : "border-zinc-700/60",
          ].join(" ")}
        />
        <button
          type="submit"
          disabled={!url.trim() || addState === "running"}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-zinc-700/60
                     text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800/60
                     transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900"
          title="Add URL"
        >
          <Plus size={14} />
        </button>
      </form>

      {/* View list link */}
      <button
        onClick={onClick}
        className="w-full text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors py-0.5"
      >
        View reading list →
      </button>
    </div>
  );
}

export function WorkflowCard({
  workflow,
  clusterName,
  clusterColor,
  onOpen,
  onRun,
  onClick,
}: Props) {
  const [loading, setLoading] = useState(false);
  const Icon = resolveIcon(workflow.icon, workflow.tags);
  const isRun = workflow.action === "run";
  const isScaffold = workflow.action === "scaffold";
  const isTranscribe = workflow.action === "transcribe";
  const isCalendar = workflow.action === "calendar";
  const isReadingList = workflow.action === "reading-list";
  const isLoan = workflow.action === "loan";
  const hasTranscribeToClaude = !isTranscribe && workflow.transcribe_to_claude;

  async function handleAction(e: React.MouseEvent) {
    e.stopPropagation();
    if (isScaffold || isCalendar || isLoan) {
      // These actions need their own modal — open it via the card click handler.
      onClick(workflow.id);
      return;
    }
    setLoading(true);
    await (isRun ? onRun(workflow.id) : onOpen(workflow.id));
    setTimeout(() => setLoading(false), 800);
  }

  async function handleTranscribed(text: string) {
    await onOpen(workflow.id, text);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(workflow.id)}
      onKeyDown={(e) => e.key === "Enter" && onClick(workflow.id)}
      className="group relative flex flex-col rounded-2xl bg-zinc-900 border border-zinc-800/60
                 overflow-hidden transition-all duration-200 cursor-pointer
                 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-black/50 hover:border-zinc-700/80
                 focus:outline-none focus:ring-2 focus:ring-zinc-600"
    >
      <div
        className="h-[3px] w-full shrink-0"
        style={{ backgroundColor: workflow.color }}
      />

      <div className="flex flex-col flex-1 p-5 gap-3">
        <div className="flex items-start gap-3">
          <span
            className="w-9 h-9 flex items-center justify-center rounded-xl shrink-0"
            style={{ backgroundColor: `${workflow.color}22` }}
          >
            <Icon
              size={18}
              style={{ color: workflow.color }}
              strokeWidth={1.75}
            />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-zinc-100 leading-snug truncate">
                {workflow.name}
              </p>
              {clusterName && (
                <span
                  className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize
                             bg-zinc-800 border-zinc-700 text-zinc-400 leading-none mt-0.5"
                  style={
                    clusterColor
                      ? {
                          borderColor: `${clusterColor}40`,
                          color: clusterColor,
                        }
                      : undefined
                  }
                >
                  {clusterName}
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-300 mt-1 truncate leading-relaxed">
              {workflow.summary ?? workflow.description}
            </p>
          </div>
        </div>

        {workflow.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {workflow.tags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>
        )}

        {workflow.scheduled_job && <SchedulePanel workflow={workflow} />}

        <div className="flex-1" />

        {isTranscribe ? (
          <TranscribeControls />
        ) : isReadingList ? (
          <ReadingListControls onClick={() => onClick(workflow.id)} />
        ) : (
          <div className="space-y-2">
            <button
              onClick={handleAction}
              disabled={loading}
              className="w-full rounded-xl py-2.5 text-sm font-medium transition-all duration-150
                         border border-zinc-700/60 text-zinc-300
                         hover:text-zinc-100 hover:border-zinc-600 hover:bg-zinc-800/60
                         disabled:opacity-50 disabled:cursor-not-allowed
                         focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-3 h-3 border border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
                  {isRun ? "Starting…" : "Opening…"}
                </span>
              ) : isRun ? (
                "Run ▶"
              ) : isScaffold ? (
                "Create ↗"
              ) : isCalendar ? (
                "Create event →"
              ) : isLoan ? (
                "New →"
              ) : (
                "Open in Claude ↗"
              )}
            </button>

            {hasTranscribeToClaude && (
              <>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-zinc-800" />
                  <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
                    or transcribe
                  </span>
                  <div className="flex-1 h-px bg-zinc-800" />
                </div>
                <TranscribeControls onTranscribed={handleTranscribed} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
