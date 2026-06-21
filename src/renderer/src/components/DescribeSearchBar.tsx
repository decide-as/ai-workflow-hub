import { Loader2, Sparkles, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  isSearching: boolean;
}

export function DescribeSearchBar({ value, onChange, isSearching }: Props) {
  return (
    <div className="search-wrap" style={{ position: "relative" }}>
      {isSearching ? (
        <Loader2 size={13} className="search-icon animate-spin" />
      ) : (
        <Sparkles size={13} className="search-icon" />
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe what you need…"
        className="search-input"
        style={{ width: "185px" }}
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
