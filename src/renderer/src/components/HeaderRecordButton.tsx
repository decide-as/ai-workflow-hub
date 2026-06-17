import { useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2, Mic, Square } from "lucide-react";
import type { Workflow } from "../../../../shared/types";

const MAX_SECONDS = 5 * 60;

function formatCountdown(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type RecordState = "idle" | "recording" | "transcribing";

export function HeaderRecordButton({ workflow: _ }: { workflow: Workflow }) {
  const [state, setState] = useState<RecordState>("idle");
  const [remaining, setRemaining] = useState(MAX_SECONDS);
  const [lastText, setLastText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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
    <div className="flex items-center gap-1.5">
      {lastText && (
        <button
          onClick={async () => {
            await window.api.copyToClipboard(lastText);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          title="Copy last transcription"
          className="view-toggle-btn"
          style={{ borderRadius: "var(--radius-sm)" }}
        >
          {copied ? (
            <Check size={13} style={{ color: "#7a9e7e" }} />
          ) : (
            <Copy size={13} />
          )}
        </button>
      )}
      <button
        onClick={() => (isRecording ? stopRecording() : startRecording())}
        disabled={isTranscribing}
        className="btn btn-sm"
        style={
          isRecording
            ? { borderColor: "rgba(239,68,68,0.45)", color: "#f87171" }
            : {}
        }
      >
        {isTranscribing ? (
          <>
            <Loader2 size={12} className="animate-spin" />
            Processing…
          </>
        ) : isRecording ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
            <Square size={11} fill="currentColor" />
            {formatCountdown(remaining)}
          </>
        ) : (
          <>
            <Mic size={12} />
            Record
          </>
        )}
      </button>
    </div>
  );
}
