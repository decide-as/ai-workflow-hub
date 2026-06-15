import { Bot } from 'lucide-react'

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-64 gap-4 text-center">
      <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center">
        <Bot size={22} className="text-zinc-500" />
      </div>
      <div>
        <p className="text-zinc-300 font-medium">No workflows yet</p>
        <p className="text-zinc-500 text-sm mt-1">Register your first workflow to get started</p>
      </div>
      <code className="text-xs text-zinc-600 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg">
        ai-hub register --name &quot;My Workflow&quot; --path /path/to/repo --tags tag1,tag2 --description &quot;…&quot;
      </code>
    </div>
  )
}
