import { Clock, MessageSquare, Play } from "lucide-react";
import type { Cluster } from "../../../../shared/types";

function hashColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 360}, 65%, 58%)`;
}

export type SolutionType = "scheduled" | "claude" | "routine";

interface TypeOption {
  id: SolutionType;
  label: string;
  color: string;
  Icon: typeof Clock;
}

const TYPE_OPTIONS: TypeOption[] = [
  { id: "scheduled", label: "Scheduled", color: "#8b5cf6", Icon: Clock },
  { id: "claude", label: "Claude", color: "#06b6d4", Icon: MessageSquare },
  { id: "routine", label: "Routine", color: "#10b981", Icon: Play },
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
    <aside
      className="w-52 shrink-0 flex flex-col border-r pt-12 pb-4 overflow-y-auto"
      style={{
        background: "rgba(255,255,255,0.02)",
        borderColor: "rgba(255,255,255,0.06)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      {/* Wordmark */}
      <div className="px-5 mb-6">
        <span className="text-sm font-semibold tracking-tight text-gradient">
          Workflow Hub
        </span>
      </div>

      {/* Workspaces */}
      <div className="px-3 mb-2">
        <p
          className="text-[9px] font-medium uppercase px-2 mb-1.5"
          style={{ letterSpacing: "0.15em", color: "rgba(255,255,255,0.22)" }}
        >
          Workspaces
        </p>

        <button
          onClick={() => onSelect(null)}
          className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-all duration-150 ${
            selected === null
              ? "text-white"
              : "text-white/40 hover:text-white/70"
          }`}
          style={
            selected === null
              ? {
                  background: "rgba(139,92,246,0.1)",
                  border: "1px solid rgba(139,92,246,0.2)",
                }
              : {
                  background: "transparent",
                  border: "1px solid transparent",
                }
          }
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              background:
                selected === null
                  ? "linear-gradient(135deg, #8b5cf6, #06b6d4)"
                  : "rgba(255,255,255,0.2)",
            }}
          />
          <span className="flex-1 text-left font-medium">All</span>
          <span
            className="text-[11px] tabular-nums"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            {totalCount}
          </span>
        </button>
      </div>

      {clusters.length > 0 && (
        <div className="px-3 mt-2">
          <div
            className="h-px mb-3"
            style={{ background: "rgba(255,255,255,0.05)" }}
          />
          <div className="space-y-0.5">
            {clusters.map((c) => {
              const color = hashColor(c.name);
              const active = selected === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-all duration-150 ${
                    active ? "text-white" : "text-white/40 hover:text-white/70"
                  }`}
                  style={
                    active
                      ? {
                          background: `${color}18`,
                          border: `1px solid ${color}30`,
                        }
                      : {
                          background: "transparent",
                          border: "1px solid transparent",
                        }
                  }
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: color, opacity: active ? 1 : 0.5 }}
                  />
                  <span className="flex-1 text-left font-medium capitalize truncate">
                    {c.name}
                  </span>
                  <span
                    className="text-[11px] tabular-nums"
                    style={{ color: "rgba(255,255,255,0.25)" }}
                  >
                    {c.workflow_ids.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Type filter */}
      <div className="px-3 mt-4">
        <div
          className="h-px mb-3"
          style={{ background: "rgba(255,255,255,0.05)" }}
        />
        <p
          className="text-[9px] font-medium uppercase px-2 mb-1.5"
          style={{ letterSpacing: "0.15em", color: "rgba(255,255,255,0.22)" }}
        >
          Type
        </p>
        <div className="space-y-0.5">
          {TYPE_OPTIONS.filter((t) => typeCounts[t.id] > 0).map((t) => {
            const active = selectedType === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onSelectType(active ? null : t.id)}
                className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-all duration-150 ${
                  active ? "text-white" : "text-white/40 hover:text-white/70"
                }`}
                style={
                  active
                    ? {
                        background: `${t.color}15`,
                        border: `1px solid ${t.color}28`,
                      }
                    : {
                        background: "transparent",
                        border: "1px solid transparent",
                      }
                }
              >
                <t.Icon
                  size={13}
                  className="shrink-0"
                  style={{ color: active ? t.color : "rgba(255,255,255,0.3)" }}
                />
                <span className="flex-1 text-left font-medium truncate">
                  {t.label}
                </span>
                <span
                  className="text-[11px] tabular-nums"
                  style={{ color: "rgba(255,255,255,0.25)" }}
                >
                  {typeCounts[t.id]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
