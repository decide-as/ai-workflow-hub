import { useEffect, useRef, useState } from "react";
import {
  X,
  Mic,
  MicOff,
  ClipboardPaste,
  Sparkles,
  Play,
  Copy,
  Check,
  Loader2,
  ImageOff,
} from "lucide-react";
import type { Workflow } from "../../../../shared/types";

interface Props {
  workflow: Workflow;
  onClose: () => void;
}

type Phase = "input" | "generating" | "review" | "running" | "done" | "error";

function todayString(): string {
  const d = new Date();
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function CalendarModal({ workflow, onClose }: Props) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("input");
  const [script, setScript] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [runOutput, setRunOutput] = useState("");
  const [copied, setCopied] = useState(false);

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    async function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) continue;
          const reader = new FileReader();
          reader.onload = () => setImage(reader.result as string);
          reader.readAsDataURL(blob);
          return;
        }
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  async function handlePasteButton() {
    const dataUrl = await window.api.readClipboardImage();
    if (dataUrl) {
      setImage(dataUrl);
    } else {
      try {
        const clipText = await navigator.clipboard.readText();
        if (clipText) setText((t) => (t ? `${t}\n${clipText}` : clipText));
      } catch {
        // ignore permission errors
      }
    }
  }

  async function handleRecord() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setTranscribing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const buf = await blob.arrayBuffer();
          const transcribed = await window.api.transcribeAudio(buf);
          setText((t) => (t ? `${t}\n${transcribed}` : transcribed));
        } catch (err) {
          setErrorMsg(String(err));
        } finally {
          setTranscribing(false);
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (err) {
      setErrorMsg(`Microphone error: ${String(err)}`);
    }
  }

  async function handleGenerate() {
    if (!text.trim() && !image) {
      setErrorMsg("Add some text or paste a screenshot first.");
      return;
    }
    setPhase("generating");
    setErrorMsg("");
    const today = todayString();
    const result = await window.api.generateCalendarScript(text, image, today);
    if (!result.success) {
      setErrorMsg(result.error ?? "Unknown error");
      setPhase("error");
      return;
    }
    setScript(result.script);
    setPhase("review");
  }

  async function handleRun() {
    setPhase("running");
    const result = await window.api.execOsascript(script);
    setRunOutput(result.output || result.error || "");
    setPhase(result.success ? "done" : "error");
    if (!result.success) setErrorMsg(result.error ?? "osascript failed");
  }

  async function handleCopy() {
    await window.api.copyToClipboard(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleReset() {
    setPhase("input");
    setScript("");
    setErrorMsg("");
    setRunOutput("");
  }

  const canGenerate =
    (text.trim().length > 0 || image !== null) && phase === "input";
  const color = workflow.color ?? "#34d399";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-overlay absolute inset-0" />
      <div
        className="modal-panel relative z-10 w-full max-w-2xl animate-slide-up flex flex-col"
        style={{ maxHeight: "90vh" }}
      >
        {/* Accent stripe */}
        <div
          className="h-px w-full rounded-t-[18px] shrink-0"
          style={{
            background: `linear-gradient(90deg, transparent, ${color}99, transparent)`,
          }}
        />

        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--c-border)" }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
            style={{ backgroundColor: color }}
          >
            📅
          </div>
          <div className="flex-1 min-w-0">
            <h2
              className="text-sm font-semibold truncate"
              style={{ color: "var(--c-text)" }}
            >
              {workflow.name}
            </h2>
            <p
              className="text-xs truncate"
              style={{ color: "var(--c-text-muted)" }}
            >
              {workflow.summary ?? workflow.description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn shrink-0 w-8 h-8"
            style={{ color: "var(--c-text-muted)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(169,146,125,0.06)";
              e.currentTarget.style.color = "var(--c-text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--c-text-muted)";
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {/* Input phase */}
          {(phase === "input" || phase === "error") && (
            <>
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-xs font-medium"
                  style={{ color: "var(--c-text-muted)" }}
                >
                  Describe the event(s)
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. Bus 261 from Sætre kl. 08:12, arrives Røyken stasjon 08:33, then train R13 towards Oslo from Røyken perrong 1 kl. 08:38…"
                  rows={5}
                  className="form-input resize-none"
                />
              </div>

              {/* Toolbar */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRecord}
                  disabled={transcribing}
                  title={recording ? "Stop recording" : "Record voice"}
                  className={`btn btn-sm flex items-center gap-1.5 ${recording ? "border-red-700/60" : ""}`}
                  style={
                    recording
                      ? {
                          background: "rgba(180,60,60,0.07)",
                          color: "rgba(220,130,130,0.9)",
                        }
                      : {}
                  }
                >
                  {transcribing ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Transcribing…
                    </>
                  ) : recording ? (
                    <>
                      <MicOff size={13} />
                      Stop
                    </>
                  ) : (
                    <>
                      <Mic size={13} />
                      Record
                    </>
                  )}
                </button>

                <button
                  onClick={handlePasteButton}
                  title="Paste image from clipboard"
                  className="btn btn-sm flex items-center gap-1.5"
                >
                  <ClipboardPaste size={13} />
                  Paste screenshot
                </button>

                <span
                  className="text-xs ml-1"
                  style={{ color: "var(--c-text-subtle)" }}
                >
                  or Cmd+V anywhere
                </span>
              </div>

              {/* Image preview */}
              {image && (
                <div
                  className="relative rounded-lg overflow-hidden"
                  style={{
                    border: "1px solid var(--c-border)",
                    background: "var(--c-surface-inset)",
                  }}
                >
                  <img
                    src={image}
                    alt="Pasted screenshot"
                    className="w-full max-h-48 object-contain"
                  />
                  <button
                    onClick={() => setImage(null)}
                    className="btn absolute top-2 right-2 p-1"
                    style={{
                      background: "var(--c-surface-raised)",
                      color: "var(--c-text-muted)",
                    }}
                    title="Remove image"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "var(--c-text)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "var(--c-text-muted)";
                    }}
                  >
                    <ImageOff size={13} />
                  </button>
                </div>
              )}

              {errorMsg && <p className="error-banner">{errorMsg}</p>}
            </>
          )}

          {/* Generating spinner */}
          {phase === "generating" && (
            <div
              className="flex flex-col items-center gap-3 py-10"
              style={{ color: "var(--c-text-muted)" }}
            >
              <Loader2 size={28} className="animate-spin" />
              <p className="text-sm">Generating AppleScript…</p>
            </div>
          )}

          {/* Script review */}
          {(phase === "review" || phase === "running") && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label
                  className="text-xs font-medium"
                  style={{ color: "var(--c-text-muted)" }}
                >
                  Generated script
                </label>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs transition-colors"
                  style={{ color: "var(--c-text-muted)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "var(--c-text-secondary)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "var(--c-text-muted)")
                  }
                >
                  {copied ? (
                    <Check size={12} className="text-emerald-400" />
                  ) : (
                    <Copy size={12} />
                  )}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="code-block max-h-72 overflow-y-auto whitespace-pre font-mono">
                {script}
              </pre>
              {phase === "running" && (
                <div
                  className="flex items-center gap-2 text-xs"
                  style={{ color: "var(--c-text-muted)" }}
                >
                  <Loader2 size={13} className="animate-spin" />
                  Running in Calendar…
                </div>
              )}
            </div>
          )}

          {/* Done */}
          {phase === "done" && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <div className="w-10 h-10 rounded-full bg-green-950/60 border border-green-700/40 flex items-center justify-center text-green-400 text-lg mb-1">
                ✓
              </div>
              <p
                className="text-sm font-medium"
                style={{ color: "var(--c-text)" }}
              >
                Events created
              </p>
              {runOutput && (
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--c-text-muted)" }}
                >
                  {runOutput}
                </p>
              )}
            </div>
          )}

          {/* Error after running */}
          {phase === "error" && script && (
            <div className="flex flex-col gap-3">
              <p className="error-banner">{errorMsg}</p>
              <pre className="code-block max-h-48 overflow-y-auto whitespace-pre font-mono">
                {script}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3 shrink-0"
          style={{ borderTop: "1px solid var(--c-border)" }}
        >
          {(phase === "done" || (phase === "error" && !script)) && (
            <button onClick={handleReset} className="btn btn-sm">
              New event
            </button>
          )}

          {phase === "review" && (
            <>
              <button onClick={handleReset} className="btn btn-sm">
                ← Back
              </button>
              <button
                onClick={handleCopy}
                className="btn btn-sm flex items-center gap-1.5"
              >
                {copied ? (
                  <Check size={12} className="text-emerald-400" />
                ) : (
                  <Copy size={12} />
                )}
                Copy script
              </button>
              <button
                onClick={handleRun}
                className="btn flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold"
                style={{ backgroundColor: color, color: "#fff" }}
              >
                <Play size={12} />
                Add to Calendar
              </button>
            </>
          )}

          {phase === "error" && script && (
            <>
              <button onClick={handleReset} className="btn btn-sm">
                ← Back
              </button>
              <button
                onClick={handleCopy}
                className="btn btn-sm flex items-center gap-1.5"
              >
                <Copy size={12} />
                Copy script
              </button>
              <button
                onClick={handleRun}
                className="btn flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold"
                style={{ backgroundColor: color, color: "#fff" }}
              >
                <Play size={12} />
                Retry
              </button>
            </>
          )}

          {phase === "input" && (
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="btn flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold"
              style={{
                backgroundColor: canGenerate ? color : undefined,
                color: canGenerate ? "#fff" : undefined,
              }}
            >
              <Sparkles size={12} />
              Generate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
