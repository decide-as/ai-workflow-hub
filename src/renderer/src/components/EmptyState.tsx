import { Workflow } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-64 gap-5 text-center">
      <div className="empty-icon">
        <Workflow size={22} />
      </div>
      <div>
        <p className="font-semibold" style={{ color: "var(--c-text)" }}>
          No workflows yet
        </p>
        <p className="text-sm mt-1" style={{ color: "var(--c-text-muted)" }}>
          Register your first workflow to get started
        </p>
      </div>
      <code className="code-block text-xs">
        ai-hub register --name &quot;My Workflow&quot; --path /path/to/repo
      </code>
    </div>
  );
}
