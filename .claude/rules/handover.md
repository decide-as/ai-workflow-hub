# Session Handover

When ending a productive session or when context is getting large, suggest creating a handover by invoking the `/handover` skill. It generates a structured briefing document that enables a fresh Claude session to continue work without re-explaining context.

When starting a session on a branch that has an existing handover file (`.claude/handover-<branch-slug>.md`), mention it: "A handover exists for this branch. Say 'resume' to load it."

Do not auto-load handovers. Do not confuse handovers with context checkpoints (intra-session) or memory (long-term knowledge).
