import { useEffect, useState } from "react";
import { X, Copy, Check, Info, Mic } from "lucide-react";
import type { TranscriptionEntry, Workflow } from "../../../../shared/types";

interface Props {
  workflow: Workflow;
  onClose: () => void;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await window.api.copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      className="btn shrink-0 w-7 h-7"
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
      {copied ? (
        <Check size={13} className="text-emerald-400" />
      ) : (
        <Copy size={13} />
      )}
    </button>
  );
}

export function TranscribeModal({ workflow, onClose }: Props) {
  const [entries, setEntries] = useState<TranscriptionEntry[]>([]);

  useEffect(() => {
    window.api.getTranscriptionLog().then(setEntries);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="modal-overlay absolute inset-0" />

      <div
        className="modal-panel relative z-10 w-full max-w-xl mx-6 animate-fade-in flex flex-col"
        style={{ maxHeight: "calc(100vh - 80px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Color stripe */}
        <div
          className="h-px w-full rounded-t-[18px] shrink-0"
          style={{
            background: `linear-gradient(90deg, transparent, ${workflow.color}99, transparent)`,
          }}
        />

        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 pt-5 pb-4 shrink-0"
          style={{ borderBottom: "1px solid var(--c-border)" }}
        >
          <span
            className="w-9 h-9 flex items-center justify-center rounded-xl shrink-0"
            style={{ backgroundColor: `${workflow.color}22` }}
          >
            <Mic
              size={17}
              style={{ color: workflow.color }}
              strokeWidth={1.75}
            />
          </span>
          <div className="flex-1 min-w-0">
            <h2
              className="text-base font-semibold leading-snug"
              style={{ color: "var(--c-text)" }}
            >
              {workflow.name}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--c-text-muted)" }}>
              Transcription log
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

        {/* 24h info banner */}
        <div
          className="mx-6 mt-4 mb-2 shrink-0 flex items-start gap-2 px-3 py-2.5 rounded-lg"
          style={{
            background: "var(--c-surface-inset)",
            border: "1px solid var(--c-border)",
            color: "var(--c-text-muted)",
          }}
        >
          <Info size={13} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">
            Transcriptions are stored locally for{" "}
            <strong style={{ color: "var(--c-text-secondary)" }}>24 hours</strong>{" "}
            and then automatically deleted. Each result is also auto-copied to
            your clipboard when recorded.
          </p>
        </div>

        {/* Log */}
        <div className="overflow-y-auto flex-1 px-6 pb-6 pt-2 space-y-3">
          {entries.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-12 gap-2"
              style={{ color: "var(--c-text-subtle)" }}
            >
              <Mic size={28} strokeWidth={1.25} />
              <p className="text-sm">No transcriptions yet</p>
              <p className="text-xs" style={{ color: "var(--c-text-subtle)" }}>
                Hit Record on the card to get started
              </p>
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="group flex items-start gap-3 p-3 rounded-xl transition-colors"
                style={{
                  background: "var(--c-surface-inset)",
                  border: "1px solid var(--c-border)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--c-border-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--c-border)";
                }}
              >
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[11px] mb-1"
                    style={{ color: "var(--c-text-subtle)" }}
                  >
                    {formatTimestamp(entry.timestamp)}
                  </p>
                  <p
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    style={{ color: "var(--c-text-secondary)" }}
                  >
                    {entry.text}
                  </p>
                </div>
                <CopyButton text={entry.text} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
