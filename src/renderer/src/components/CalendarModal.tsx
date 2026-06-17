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

  // Voice recording
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Paste image from clipboard (Cmd+V in the modal)
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
      // Try reading text from clipboard as fallback
      try {
        const clipText = await navigator.clipboard.readText();
        if (clipText) setText((t) => t ? `${t}\n${clipText}` : clipText);
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
          setText((t) => t ? `${t}\n${transcribed}` : transcribed);
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

  const canGenerate = (text.trim().length > 0 || image !== null) && phase === "input";
  const color = workflow.color ?? "#34d399";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-2xl bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800 shrink-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm shrink-0"
            style={{ backgroundColor: color }}
          >
            📅
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-zinc-100 truncate">{workflow.name}</h2>
            <p className="text-xs text-zinc-500 truncate">{workflow.summary ?? workflow.description}</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {/* Input phase */}
          {(phase === "input" || phase === "error") && (
            <>
              {/* Text area */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-400">
                  Describe the event(s)
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. Bus 261 from Sætre kl. 08:12, arrives Røyken stasjon 08:33, then train R13 towards Oslo from Røyken perrong 1 kl. 08:38…"
                  rows={5}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 resize-none focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>

              {/* Toolbar: record + paste */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRecord}
                  disabled={transcribing}
                  title={recording ? "Stop recording" : "Record voice"}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    recording
                      ? "bg-red-950/50 border-red-700/60 text-red-300 hover:bg-red-950"
                      : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
                  } disabled:opacity-50`}
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
                >
                  <ClipboardPaste size={13} />
                  Paste screenshot
                </button>

                <span className="text-xs text-zinc-600 ml-1">or Cmd+V anywhere</span>
              </div>

              {/* Image preview */}
              {image && (
                <div className="relative rounded-lg overflow-hidden border border-zinc-700 bg-zinc-800">
                  <img
                    src={image}
                    alt="Pasted screenshot"
                    className="w-full max-h-48 object-contain"
                  />
                  <button
                    onClick={() => setImage(null)}
                    className="absolute top-2 right-2 p-1 rounded bg-zinc-900/80 text-zinc-400 hover:text-zinc-100 transition-colors"
                    title="Remove image"
                  >
                    <ImageOff size={13} />
                  </button>
                </div>
              )}

              {errorMsg && (
                <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
                  {errorMsg}
                </p>
              )}
            </>
          )}

          {/* Generating spinner */}
          {phase === "generating" && (
            <div className="flex flex-col items-center gap-3 py-10 text-zinc-400">
              <Loader2 size={28} className="animate-spin text-zinc-500" />
              <p className="text-sm">Generating AppleScript…</p>
            </div>
          )}

          {/* Script review */}
          {(phase === "review" || phase === "running") && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-400">Generated script</label>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-300 overflow-x-auto whitespace-pre font-mono leading-relaxed max-h-72 overflow-y-auto">
                {script}
              </pre>
              {phase === "running" && (
                <div className="flex items-center gap-2 text-xs text-zinc-500">
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
              <p className="text-sm font-medium text-zinc-100">Events created</p>
              {runOutput && (
                <p className="text-xs text-zinc-500 mt-1">{runOutput}</p>
              )}
            </div>
          )}

          {/* Error after running */}
          {phase === "error" && script && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
                {errorMsg}
              </p>
              <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-300 overflow-x-auto whitespace-pre font-mono leading-relaxed max-h-48 overflow-y-auto">
                {script}
              </pre>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-800 shrink-0">
          {(phase === "done" || (phase === "error" && !script)) && (
            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              New event
            </button>
          )}

          {phase === "review" && (
            <>
              <button
                onClick={handleReset}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                Copy script
              </button>
              <button
                onClick={handleRun}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
                style={{ backgroundColor: color }}
              >
                <Play size={12} />
                Add to Calendar
              </button>
            </>
          )}

          {phase === "error" && script && (
            <>
              <button
                onClick={handleReset}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                <Copy size={12} />
                Copy script
              </button>
              <button
                onClick={handleRun}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
                style={{ backgroundColor: color }}
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
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: canGenerate ? color : undefined }}
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
