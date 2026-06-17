import { useEffect, useState } from "react";
import { X, ExternalLink, BookOpen } from "lucide-react";
import type { ReadingListEntry, Workflow } from "../../../../shared/types";

interface Props {
  workflow: Workflow;
  onClose: () => void;
}

function formatDate(iso: string): string {
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
    window.api.readingListGetEntries(200).then((result) => {
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full max-w-2xl mx-6 rounded-2xl bg-zinc-900 border border-zinc-800
                   shadow-2xl shadow-black/60 animate-fade-in flex flex-col"
        style={{ maxHeight: "calc(100vh - 80px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="h-1 w-full rounded-t-2xl shrink-0"
          style={{ backgroundColor: workflow.color }}
        />

        <div className="flex items-center gap-3 px-6 pt-5 pb-4 shrink-0">
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
            <h2 className="text-base font-semibold text-zinc-100 leading-snug">
              {workflow.name}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {loading ? "Loading…" : `${entries.length} saved URLs`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg
                       text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 pb-6 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-zinc-600 text-sm">
              Loading…
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-600">
              <BookOpen size={28} strokeWidth={1.25} />
              <p className="text-sm">No reading notes yet</p>
              <p className="text-xs text-zinc-700">
                Import from Reminders or paste a URL on the card
              </p>
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="group flex items-start gap-3 p-3 rounded-xl bg-zinc-800/40
                           border border-zinc-700/30 hover:border-zinc-700/60 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-zinc-600 mb-1">
                    {domainOf(entry.url)} · {formatDate(entry.added_at)} ·{" "}
                    <span className="capitalize">{entry.source}</span>
                  </p>
                  {entry.title ? (
                    <p className="text-sm text-zinc-200 leading-snug mb-1">
                      {entry.title}
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-500 font-mono leading-snug break-all">
                      {truncateUrl(entry.url)}
                    </p>
                  )}
                  {entry.notes && (
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
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
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg
                             text-zinc-600 hover:text-zinc-300 hover:bg-zinc-700/60 transition-colors"
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
