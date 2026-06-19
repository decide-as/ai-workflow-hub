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
import { resolveIcon } from "../lib/icons";
import { BookkeepingControls } from "./BookkeepingControls";

interface Props {
  workflow: Workflow;
  clusterName?: string;
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

// ── Compact inline record button ──────────────────────────────────────────────

type RecordState = "idle" | "recording" | "transcribing";

function TranscribeControls({
  onTranscribed,
}: {
  onTranscribed?: (text: string) => void;
}) {
  const [state, setState] = useState<RecordState>("idle");
  const [remaining, setRemaining] = useState(MAX_SECONDS);
  const [copied, setCopied] = useState(false);
  const [lastText, setLastText] = useState<string | null>(null);
  const [, setError] = useState<string | null>(null);
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
          const text = await window.api.transcribeAudio(
            await blob.arrayBuffer(),
          );
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
      timerRef.current = setInterval(
        () => setRemaining((p) => Math.max(0, p - 1)),
        1000,
      );
    } catch {
      setState("idle");
    }
  }

  function stopRecording() {
    clearTimer();
    mediaRef.current?.stop();
    mediaRef.current = null;
  }

  const isRecording = state === "recording";
  const isTranscribing = state === "transcribing";

  return (
    <div
      className="flex items-center gap-1.5 shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      {lastText && (
        <button
          onClick={async (e) => {
            e.stopPropagation();
            await window.api.copyToClipboard(lastText);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="btn btn-sm w-7 h-7 p-0"
        >
          {copied ? (
            <Check size={11} style={{ color: "#7a9e7e" }} />
          ) : (
            <Copy size={11} />
          )}
        </button>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (isRecording) {
            stopRecording();
          } else {
            startRecording();
          }
        }}
        disabled={isTranscribing}
        className="btn btn-sm"
        style={
          isRecording
            ? { borderColor: "rgba(239,68,68,0.4)", color: "#f87171" }
            : {}
        }
      >
        {isTranscribing ? (
          <>
            <Loader2 size={11} className="animate-spin" />
            Processing…
          </>
        ) : isRecording ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
            <Square size={10} fill="currentColor" />
            {formatCountdown(remaining)}
          </>
        ) : (
          <>
            <Mic size={11} />
            Record
          </>
        )}
      </button>
    </div>
  );
}

// ── Compact inline action button ──────────────────────────────────────────────

function InlineActionButton({
  workflow,
  onOpen,
  onRun,
  onClick,
}: {
  workflow: Workflow;
  onOpen: (id: string, initialPrompt?: string) => void;
  onRun: (id: string) => void;
  onClick: (id: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const isRun = workflow.action === "run";
  const isScaffold = workflow.action === "scaffold";
  const isCalendar = workflow.action === "calendar";
  const isLoan = workflow.action === "loan";
  const isLoanInterest = workflow.action === "loan-interest";
  const isEmployeeGifts = workflow.action === "employee-gifts";

  async function handleAction(e: React.MouseEvent) {
    e.stopPropagation();
    if (
      isScaffold ||
      isCalendar ||
      isLoan ||
      isLoanInterest ||
      isEmployeeGifts
    ) {
      onClick(workflow.id);
      return;
    }
    setLoading(true);
    await (isRun ? onRun(workflow.id) : onOpen(workflow.id));
    setTimeout(() => setLoading(false), 800);
  }

  return (
    <button
      onClick={handleAction}
      disabled={loading}
      className="btn btn-sm shrink-0"
    >
      {loading ? (
        <Loader2 size={11} className="animate-spin" />
      ) : isRun ? (
        <>
          <Play size={11} fill="currentColor" />
          Run
        </>
      ) : isScaffold ? (
        <>
          <GitBranch size={11} />
          Create
        </>
      ) : isLoan || isLoanInterest || isEmployeeGifts ? (
        <>
          <Plus size={11} />
          New
        </>
      ) : (
        <>
          <ExternalLink size={11} />
          Open
        </>
      )}
    </button>
  );
}

// ── Reading list footer ───────────────────────────────────────────────────────

type ImportState = "idle" | "running" | "done" | "error";

function ReadingListFooter({ onClick }: { onClick: () => void }) {
  const [importState, setImportState] = useState<ImportState>("idle");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleImport(e: React.MouseEvent) {
    e.stopPropagation();
    setImportState("running");
    const result = await window.api.readingListImport();
    setImportMsg(result.success ? `+${result.imported ?? 0}` : "Error");
    setImportState(result.success ? "done" : "error");
    setTimeout(() => {
      setImportState("idle");
      setImportMsg(null);
    }, 3000);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    const trimmed = url.trim();
    if (!trimmed) return;
    setAdding(true);
    const result = await window.api.readingListAddUrl(trimmed);
    if (result.success) setUrl("");
    setAdding(false);
  }

  return (
    <form
      onSubmit={handleAdd}
      className="flex items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        placeholder="Paste a URL…"
        disabled={adding}
        className="form-input flex-1"
        style={{ padding: "5px 10px", fontSize: "11px" }}
      />
      <button
        type="submit"
        disabled={!url.trim() || adding}
        className="btn btn-sm w-7 h-7 p-0 shrink-0"
      >
        <Plus size={12} />
      </button>
      <button
        type="button"
        onClick={handleImport}
        disabled={importState === "running"}
        className="btn btn-sm shrink-0"
        style={
          importState === "done"
            ? { borderColor: "rgba(122,158,126,0.4)", color: "#7a9e7e" }
            : importState === "error"
              ? {
                  borderColor: "rgba(180,60,60,0.3)",
                  color: "rgba(220,110,110,0.85)",
                }
              : {}
        }
      >
        <RefreshCw
          size={11}
          className={importState === "running" ? "animate-spin" : ""}
        />
        {importMsg ?? "Sync"}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="btn btn-sm shrink-0"
      >
        <ExternalLink size={11} />
        View
      </button>
    </form>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

export function WorkflowCard({
  workflow,
  clusterName,
  onOpen,
  onRun,
  onClick,
}: Props) {
  const Icon = resolveIcon(workflow.icon, workflow.tags);
  const isTranscribe = workflow.action === "transcribe";
  const isReadingList = workflow.action === "reading-list";

  const actionBtn = isTranscribe ? (
    <TranscribeControls />
  ) : (
    <InlineActionButton
      workflow={workflow}
      onOpen={onOpen}
      onRun={onRun}
      onClick={onClick}
    />
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(workflow.id)}
      onKeyDown={(e) => e.key === "Enter" && onClick(workflow.id)}
      className="workflow-card"
    >
      <div
        className="card-stripe"
        style={{
          background: `linear-gradient(90deg, transparent, ${workflow.color}77, transparent)`,
        }}
      />

      <div className="p-4 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <span
            className="card-icon shrink-0"
            style={{ backgroundColor: `${workflow.color}18` }}
          >
            <Icon
              size={16}
              style={{ color: workflow.color }}
              strokeWidth={1.75}
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="card-name truncate">{workflow.name}</p>
              {clusterName && (
                <span className="cluster-badge">{clusterName}</span>
              )}
            </div>
            <p className="card-desc mt-0.5">
              {workflow.summary ?? workflow.description}
            </p>
          </div>
        </div>

        {/* Footer: reading-list inline form, bookkeeping controls, or plain action CTA */}
        {isReadingList ? (
          <ReadingListFooter onClick={() => onClick(workflow.id)} />
        ) : workflow.action === "bookkeeping" ? (
          <BookkeepingControls workflow={workflow} />
        ) : (
          <div className="flex items-center">
            <div className="flex-1" />
            {actionBtn}
          </div>
        )}
      </div>
    </div>
  );
}
