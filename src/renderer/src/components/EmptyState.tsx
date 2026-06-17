import { Workflow } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-64 gap-5 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{
          background: "rgba(139,92,246,0.1)",
          border: "1px solid rgba(139,92,246,0.2)",
          boxShadow: "0 0 30px rgba(139,92,246,0.1)",
        }}
      >
        <Workflow size={24} style={{ color: "rgba(139,92,246,0.8)" }} />
      </div>
      <div>
        <p className="font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
          No workflows yet
        </p>
        <p
          className="text-sm mt-1"
          style={{ color: "rgba(255,255,255,0.3)" }}
        >
          Register your first workflow to get started
        </p>
      </div>
      <code
        className="text-xs px-3 py-2 rounded-lg"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          color: "rgba(255,255,255,0.35)",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        ai-hub register --name &quot;My Workflow&quot; --path /path/to/repo
      </code>
    </div>
  );
}
