export function TagBadge({ tag }: { tag: string }) {
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{
        background: "rgba(139,92,246,0.1)",
        border: "1px solid rgba(139,92,246,0.18)",
        color: "rgba(167,139,250,0.85)",
      }}
    >
      {tag}
    </span>
  );
}
