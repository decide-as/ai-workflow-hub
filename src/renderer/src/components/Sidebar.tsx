import { Clock, MessageSquare, Play } from "lucide-react";
import type { Cluster } from "../../../../shared/types";

function hashColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 360}, 45%, 55%)`;
}

export type SolutionType = "scheduled" | "claude" | "routine";

interface TypeOption {
  id: SolutionType;
  label: string;
  Icon: typeof Clock;
}

const TYPE_OPTIONS: TypeOption[] = [
  { id: "scheduled", label: "Scheduled", Icon: Clock },
  { id: "claude",    label: "Claude",    Icon: MessageSquare },
  { id: "routine",   label: "Routine",   Icon: Play },
];

interface Props {
  clusters: Cluster[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  totalCount: number;
  selectedType: SolutionType | null;
  onSelectType: (t: SolutionType | null) => void;
  typeCounts: Record<SolutionType, number>;
}

export function Sidebar({
  clusters,
  selected,
  onSelect,
  totalCount,
  selectedType,
  onSelectType,
  typeCounts,
}: Props) {
  return (
    <aside className="sidebar w-52 shrink-0 flex flex-col pt-12 pb-4 overflow-y-auto">
      {/* Wordmark */}
      <div className="px-5 mb-7">
        <span className="sidebar-wordmark">Workflow Hub</span>
      </div>

      {/* Workspaces */}
      <div className="px-3 mb-1">
        <p className="section-label">Workspaces</p>

        <button
          onClick={() => onSelect(null)}
          className={`sidebar-item ${selected === null ? "is-active" : ""}`}
        >
          <span className="sidebar-dot" />
          <span className="flex-1 truncate">All</span>
          <span className="sidebar-count">{totalCount}</span>
        </button>

        {clusters.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {clusters.map((c) => {
              const color = hashColor(c.name);
              const active = selected === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className={`sidebar-item ${active ? "is-active" : ""}`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0 transition-opacity"
                    style={{
                      backgroundColor: color,
                      opacity: active ? 1 : 0.4,
                    }}
                  />
                  <span className="flex-1 capitalize truncate">{c.name}</span>
                  <span className="sidebar-count">{c.workflow_ids.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Type filter */}
      <div className="px-3 mt-4">
        <div className="divider mb-4" />
        <p className="section-label">Type</p>
        <div className="space-y-0.5">
          {TYPE_OPTIONS.filter((t) => typeCounts[t.id] > 0).map((t) => {
            const active = selectedType === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onSelectType(active ? null : t.id)}
                className={`sidebar-item ${active ? "is-active" : ""}`}
              >
                <t.Icon size={13} className="shrink-0 transition-opacity" style={{ opacity: active ? 1 : 0.45 }} />
                <span className="flex-1 truncate">{t.label}</span>
                <span className="sidebar-count">{typeCounts[t.id]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
