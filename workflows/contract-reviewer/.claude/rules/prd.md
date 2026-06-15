# PRD & Design Doc Generation

When the user's request implies building something new that spans multiple files, invoke the `/prd` skill. It generates a PRD (problem and outcomes) and, when architecturally non-trivial, a Design Doc (architecture and plan) before coding starts.

Do not trigger for bug fixes, single-file changes, questions, or when the user says to skip.
