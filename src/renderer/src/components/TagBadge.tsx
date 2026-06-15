function tagColor(tag: string): string {
  let h = 0
  for (let i = 0; i < tag.length; i++) h = tag.charCodeAt(i) + ((h << 5) - h)
  return `hsla(${Math.abs(h) % 360}, 55%, 60%, 0.18)`
}

export function TagBadge({ tag }: { tag: string }) {
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[11px] font-medium text-zinc-400 border border-zinc-800/80"
      style={{ backgroundColor: tagColor(tag) }}
    >
      {tag}
    </span>
  )
}
