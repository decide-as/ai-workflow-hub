import { Loader2, Search, Sparkles, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  isSemanticLoading?: boolean;
  isSemanticActive?: boolean;
}

export function SearchBar({
  value,
  onChange,
  isSemanticLoading,
  isSemanticActive,
}: Props) {
  const Icon = isSemanticLoading
    ? Loader2
    : isSemanticActive
      ? Sparkles
      : Search;

  return (
    <div className="search-wrap" style={{ position: "relative" }}>
      <Icon
        size={13}
        className={`search-icon${isSemanticLoading ? " animate-spin" : ""}`}
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search or describe…"
        className="search-input"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          style={{
            position: "absolute",
            right: "6px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--c-text-subtle)",
            lineHeight: 0,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
          title="Clear"
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
}
