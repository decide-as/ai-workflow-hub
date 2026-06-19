import { useEffect, useState } from "react";
import { X, ExternalLink, BookOpen, Info } from "lucide-react";
import type { ReadingListEntry, Workflow } from "../../../../shared/types";

interface Props {
  workflow: Workflow;
  onClose: () => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function truncateUrl(url: string, max = 60): string {
  if (url.length <= max) return url;
  return url.slice(0, max) + "…";
}

export function ReadingListModal({ workflow, onClose }: Props) {
  const [entries, setEntries] = useState<ReadingListEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.api.readingListGetEntries().then((result) => {
      setEntries(Array.isArray(result) ? result : []);
      setLoading(false);
    });
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
        className="modal-panel relative z-10 w-full max-w-2xl mx-6 animate-fade-in flex flex-col"
        style={{ maxHeight: "calc(100vh - 80px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="h-px w-full rounded-t-[18px] shrink-0"
          style={{
            background: `linear-gradient(90deg, transparent, ${workflow.color}99, transparent)`,
          }}
        />

        <div
          className="flex items-center gap-3 px-6 pt-5 pb-4 shrink-0"
          style={{ borderBottom: "1px solid var(--c-border)" }}
        >
          <span
            className="w-9 h-9 flex items-center justify-center rounded-xl shrink-0"
            style={{ backgroundColor: `${workflow.color}22` }}
          >
            <BookOpen
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
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--c-text-muted)" }}
            >
              {loading ? "Loading…" : `${entries.length} saved URLs`}
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
            "Get from Reminders" imports from{" "}
            <strong style={{ color: "var(--c-text-secondary)" }}>
              Leseliste
            </strong>{" "}
            and{" "}
            <strong style={{ color: "var(--c-text-secondary)" }}>
              Prioritert leseliste
            </strong>{" "}
            only. Duplicate URLs are skipped automatically.
          </p>
        </div>

        <div className="overflow-y-auto flex-1 px-6 pb-6 pt-2 space-y-2">
          {loading ? (
            <div
              className="flex items-center justify-center py-12 text-sm"
              style={{ color: "var(--c-text-subtle)" }}
            >
              Loading…
            </div>
          ) : entries.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-12 gap-2"
              style={{ color: "var(--c-text-subtle)" }}
            >
              <BookOpen size={28} strokeWidth={1.25} />
              <p className="text-sm">No reading notes yet</p>
              <p className="text-xs">
                Import from Reminders or paste a URL on the card
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
                    {domainOf(entry.url)}
                    {entry.added_at ? ` · ${formatDate(entry.added_at)}` : ""}
                    {" · "}
                    <span className="capitalize">{entry.source}</span>
                  </p>
                  <p
                    className="text-xs font-mono leading-snug break-all"
                    style={{ color: "var(--c-text-muted)" }}
                  >
                    {truncateUrl(entry.url)}
                  </p>
                  {entry.notes && (
                    <p
                      className="text-xs mt-1 leading-relaxed"
                      style={{ color: "var(--c-text-muted)" }}
                    >
                      {entry.notes}
                    </p>
                  )}
                </div>
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Open URL"
                  className="btn shrink-0 w-7 h-7"
                  style={{ color: "var(--c-text-subtle)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(169,146,125,0.06)";
                    e.currentTarget.style.color = "var(--c-text-muted)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--c-text-subtle)";
                  }}
                >
                  <ExternalLink size={13} />
                </a>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
