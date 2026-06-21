import { useEffect, useRef, useState } from "react";
import { X, Settings, Monitor, Pencil, Check } from "lucide-react";
import type {
  MachineConfig,
  Registry,
  Workflow,
} from "../../../../shared/types";

interface Props {
  onClose: () => void;
}

export function SettingsModal({ onClose }: Props) {
  const [config, setConfig] = useState<MachineConfig | null>(null);
  const [allWorkflows, setAllWorkflows] = useState<Workflow[]>([]);
  const [allClusters, setAllClusters] = useState<Registry["clusters"]>([]);
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const nicknameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      window.api.machineConfigGet(),
      window.api.registryGetAll(),
    ]).then(([cfg, reg]) => {
      setConfig(cfg);
      setNicknameInput(cfg.nickname ?? "");
      setAllWorkflows(reg.workflows);
      setAllClusters(reg.clusters);
    });
  }, []);

  useEffect(() => {
    if (editingNickname) nicknameRef.current?.focus();
  }, [editingNickname]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function isEnabled(id: string): boolean {
    if (!config) return true;
    const entry = config.workflows.find((e) => e.id === id);
    return entry ? entry.enabled : true;
  }

  async function writeConfig(updated: MachineConfig) {
    setSaveError(null);
    const result = await window.api.machineConfigSet(updated);
    if (!result.success) {
      setSaveError(result.error ?? "Failed to save");
    } else {
      setConfig(updated);
    }
  }

  async function handleToggle(id: string) {
    if (!config) return;
    const existing = config.workflows.find((e) => e.id === id);
    let workflows;
    if (existing) {
      workflows = config.workflows.map((e) =>
        e.id === id ? { ...e, enabled: !e.enabled } : e,
      );
    } else {
      // absent = enabled; first toggle = disable
      workflows = [...config.workflows, { id, enabled: false }];
    }
    await writeConfig({ ...config, workflows });
  }

  async function commitNickname() {
    if (!config) return;
    setEditingNickname(false);
    await writeConfig({
      ...config,
      nickname: nicknameInput.trim() || undefined,
    });
  }

  function clusterName(clusterId: string | null): string {
    if (!clusterId) return "";
    return allClusters.find((c) => c.id === clusterId)?.name ?? "";
  }

  const displayName = config?.nickname || config?.machine_id || "This machine";

  // Group workflows by cluster name, preserving cluster order
  const grouped: { name: string; workflows: typeof allWorkflows }[] = [];
  for (const w of allWorkflows) {
    const name = clusterName(w.cluster_id) || "Other";
    const existing = grouped.find((g) => g.name === name);
    if (existing) existing.workflows.push(w);
    else grouped.push({ name, workflows: [w] });
  }

  return (
    <div
      className="animate-fade-in"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-overlay"
        style={{ position: "absolute", inset: 0 }}
        onClick={onClose}
      />
      <div
        className="modal-panel"
        style={{
          maxWidth: 480,
          width: "100%",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "18px 20px 14px",
          }}
        >
          <Settings
            size={15}
            style={{ color: "var(--c-accent)", flexShrink: 0 }}
          />
          <span
            className="modal-title"
            style={{ flex: 1, fontSize: 14, fontWeight: 600 }}
          >
            Settings
          </span>
          <button className="modal-close" onClick={onClose} title="Close">
            <X size={14} />
          </button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "0 20px 20px" }}>
          {/* Machine identity */}
          <section style={{ marginBottom: 20 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <Monitor
                size={13}
                style={{ color: "var(--c-text-subtle)", flexShrink: 0 }}
              />
              {editingNickname ? (
                <input
                  ref={nicknameRef}
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  onBlur={commitNickname}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitNickname();
                    if (e.key === "Escape") {
                      setEditingNickname(false);
                      setNicknameInput(config?.nickname ?? "");
                    }
                  }}
                  placeholder="Machine nickname"
                  className="form-input"
                  style={{ flex: 1, fontSize: 13 }}
                />
              ) : (
                <>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--c-text)",
                    }}
                  >
                    {displayName}
                  </span>
                  <button
                    onClick={() => setEditingNickname(true)}
                    title="Edit nickname"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "2px 4px",
                      color: "var(--c-text-subtle)",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <Pencil size={11} />
                  </button>
                  {editingNickname === false && config?.nickname && (
                    <button
                      onClick={commitNickname}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "2px 4px",
                        color: "var(--c-accent)",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <Check size={11} />
                    </button>
                  )}
                </>
              )}
            </div>
            {config?.machine_id && (
              <p
                style={{
                  fontSize: 11,
                  color: "var(--c-text-subtle)",
                  marginLeft: 21,
                }}
              >
                {config.machine_id}
              </p>
            )}
          </section>

          {/* Workflow availability */}
          <section>
            <h3
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--c-text-subtle)",
                marginBottom: 10,
              }}
            >
              Workflow availability on this machine
            </h3>

            {saveError && (
              <p
                style={{
                  fontSize: 12,
                  color: "rgba(220,100,100,0.9)",
                  marginBottom: 8,
                }}
              >
                {saveError}
              </p>
            )}

            {allWorkflows.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--c-text-subtle)" }}>
                No workflows registered.
              </p>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                {grouped.map((group) => (
                  <div key={group.name}>
                    <p
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--c-text-subtle)",
                        marginBottom: 4,
                        paddingLeft: 2,
                      }}
                    >
                      {group.name}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0,
                      }}
                    >
                      {group.workflows.map((w) => {
                        const enabled = isEnabled(w.id);
                        return (
                          <label
                            key={w.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "3px 6px",
                              borderRadius: "var(--radius-sm)",
                              cursor: "pointer",
                              background: enabled
                                ? "transparent"
                                : "var(--c-surface-alt, rgba(0,0,0,0.08))",
                              opacity: enabled ? 1 : 0.5,
                              transition: "background 0.1s, opacity 0.1s",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={() => handleToggle(w.id)}
                              style={{
                                flexShrink: 0,
                                accentColor: "var(--c-accent)",
                              }}
                            />
                            <span
                              style={{ fontSize: 13, color: "var(--c-text)" }}
                            >
                              {w.name}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--c-border)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button className="btn btn-primary btn-sm" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
