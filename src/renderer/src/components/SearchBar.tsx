import { Search } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function SearchBar({ value, onChange }: Props) {
  return (
    <div className="relative">
      <Search
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search workflows…"
        className="pl-8 pr-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50
                   text-sm text-zinc-200 placeholder:text-zinc-600
                   focus:outline-none focus:ring-1 focus:ring-zinc-600 focus:border-zinc-600
                   w-48 transition-all"
      />
    </div>
  );
}
