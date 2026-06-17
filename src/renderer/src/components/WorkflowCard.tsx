import { useEffect, useRef, useState } from "react";
import {
  Copy,
  Check,
  Square,
  Mic,
  Loader2,
  RefreshCw,
  Plus,
  Play,
  ExternalLink,
  GitBranch,
} from "lucide-react";
import type { Workflow } from "../../../../shared/types";
import { TagBadge } from "./TagBadge";
import { SchedulePanel } from "./SchedulePanel";
import { resolveIcon } from "../lib/icons";

interface Props {
  workflow: Workflow;
  clusterName?: string;
  onOpen: (id: string) => void;
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

function TranscribeControls(_: { workflow: Workflow }) {
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
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        clearTimer();
        stream.getTracks().forEach((t) => t.stop());
        setState("transcribing");
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm;codecs=opus" });
          const arrayBuffer = await blob.arrayBuffer();
          const text = await window.api.transcribeAudio(arrayBuffer);
          await window.api.copyToClipboard(text);
          await window.api.saveTranscription(text);
          setLastText(text);
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
      setError(err instanceof Error ? err.message : "Could not access microphone");
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
    if (state === "recording") stopRecording();
    else if (state === "idle") startRecording();
  }

  const isRecording = state === "recording";
  const isTranscribing = state === "transcribing";
  const busy = isRecording || isTranscribing;

  return (
    <div className="space-y-2">
      {error && <p className="text-[11px] text-red-400 leading-snug">{error}</p>}
      {lastText && (
        <p className="text-[11px] leading-snug line-clamp-2" style={{ color: "var(--c-text-subtle)" }}>
          {lastText}
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleRecordClick}
          disabled={isTranscribing}
          className="btn flex-1"
          style={
            isRecording
              ? { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }
              : { background: "rgba(169,146,125,0.06)", border: "1px solid var(--c-border-hover)", color: "var(--c-accent)" }
          }
        >
          {isTranscribing ? (
            <><Loader2 size={14} className="animate-spin" />Transcribing…</>
          ) : isRecording ? (
            <>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              <Square size={13} fill="currentColor" />Stop
              <span className="tabular-nums text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5" }}>
                {formatCountdown(remaining)}
              </span>
            </>
          ) : (
            <><Mic size={14} />Record</>
          )}
        </button>
        {lastText && (
          <button
            onClick={handleCopy}
            disabled={busy}
            title="Copy last transcription"
            className="btn w-10 h-10"
            style={{ border: "1px solid var(--c-border)", color: "var(--c-text-muted)" }}
          >
            {copied ? <Check size={14} style={{ color: "#7a9e7e" }} /> : <Copy size={14} />}
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
      setImportMsg(`+${result.imported ?? 0} new · ${result.duplicates ?? 0} dupes`);
      setImportState("done");
    } else {
      setImportMsg(result.error ?? "Import failed");
      setImportState("error");
    }
    setTimeout(() => { setImportState("idle"); setImportMsg(null); }, 4000);
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
    setTimeout(() => { setAddState("idle"); setAddMsg(null); }, 3000);
  }

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={handleImport}
        disabled={importState === "running"}
        className="btn w-full"
        style={
          importState === "done"
            ? { background: "rgba(122,158,126,0.08)", border: "1px solid rgba(122,158,126,0.25)", color: "#7a9e7e" }
            : importState === "error"
              ? { background: "rgba(180,60,60,0.07)", border: "1px solid rgba(180,60,60,0.2)", color: "rgba(230,130,130,0.9)" }
              : { background: "rgba(169,146,125,0.06)", border: "1px solid var(--c-border-hover)", color: "var(--c-accent)" }
        }
      >
        <RefreshCw size={13} className={importState === "running" ? "animate-spin" : ""} />
        {importState === "running" ? "Importing…" : (importMsg ?? "Get from Reminders")}
      </button>

      <form onSubmit={handleAddUrl} className="flex gap-1.5">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder={addState === "done" ? "Added ✓" : addState === "error" ? (addMsg ?? "Error") : "Paste a URL…"}
          disabled={addState === "running"}
          className="form-input flex-1"
        />
        <button
          type="submit"
          disabled={!url.trim() || addState === "running"}
          className="btn w-9 h-9 shrink-0"
          style={{ border: "1px solid var(--c-border)", color: "var(--c-text-muted)" }}
          title="Add URL"
        >
          <Plus size={14} />
        </button>
      </form>

      <button
        onClick={onClick}
        className="w-full text-[11px] text-left transition-colors py-0.5"
        style={{ color: "var(--c-text-subtle)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--c-accent)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--c-text-subtle)")}
      >
        View reading list →
      </button>
    </div>
  );
}

export function WorkflowCard({ workflow, clusterName, onOpen, onRun, onClick }: Props) {
  const [loading, setLoading] = useState(false);
  const Icon = resolveIcon(workflow.icon, workflow.tags);
  const isRun = workflow.action === "run";
  const isScaffold = workflow.action === "scaffold";
  const isTranscribe = workflow.action === "transcribe";
  const isReadingList = workflow.action === "reading-list";

  async function handleAction(e: React.MouseEvent) {
    e.stopPropagation();
    if (isScaffold) { onClick(workflow.id); return; }
    setLoading(true);
    await (isRun ? onRun(workflow.id) : onOpen(workflow.id));
    setTimeout(() => setLoading(false), 800);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(workflow.id)}
      onKeyDown={(e) => e.key === "Enter" && onClick(workflow.id)}
      className="workflow-card flex flex-col"
    >
      {/* Accent stripe — workflow color, fades at edges */}
      <div
        className="card-stripe"
        style={{ background: `linear-gradient(90deg, transparent, ${workflow.color}88, transparent)` }}
      />

      <div className="flex flex-col flex-1 p-5 gap-3">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <span className="card-icon" style={{ backgroundColor: `${workflow.color}18` }}>
            <Icon size={17} style={{ color: workflow.color }} strokeWidth={1.75} />
          </span>

          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-start justify-between gap-2">
              <p className="card-name truncate">{workflow.name}</p>
              {clusterName && <span className="cluster-badge mt-0.5">{clusterName}</span>}
            </div>
            <p className="card-desc mt-1 truncate">{workflow.summary ?? workflow.description}</p>
          </div>
        </div>

        {workflow.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {workflow.tags.map((tag) => <TagBadge key={tag} tag={tag} />)}
          </div>
        )}

        {workflow.scheduled_job && <SchedulePanel workflow={workflow} />}

        <div className="flex-1" />

        {isTranscribe ? (
          <TranscribeControls workflow={workflow} />
        ) : isReadingList ? (
          <ReadingListControls onClick={() => onClick(workflow.id)} />
        ) : (
          <button
            onClick={handleAction}
            disabled={loading}
            className="btn btn-ghost"
          >
            {loading ? (
              <><Loader2 size={14} className="animate-spin" />{isRun ? "Starting…" : "Opening…"}</>
            ) : isRun ? (
              <><Play size={13} fill="currentColor" />Run</>
            ) : isScaffold ? (
              <><GitBranch size={13} />Create</>
            ) : (
              <><ExternalLink size={13} />Open in Claude</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
