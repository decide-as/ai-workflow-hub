---
bump: minor
---

### Added
- Voice Transcriber workflow card with in-card Record/Stop button, 5-minute countdown timer with auto-stop, and live transcription via OpenAI Whisper (gpt-4o-transcribe model).
- Transcriptions are automatically copied to clipboard after each recording.
- Last transcription shown on the card with a one-click Copy button.
- Transcription log persists for 24 hours; accessible via a modal by clicking the card body.
- OpenAI API key loaded from a `.env` file at the repo root — works from both the main checkout and any worktree via `git rev-parse --git-common-dir`.
- `.prettierignore` added; full codebase formatted with Prettier so `make lint` now passes cleanly.
