---
bump: minor
---

### Added

- Web Scraper workflow card — paste any URL (web article, Instagram, LinkedIn, YouTube, PDF) and Claude runs the scrapers repo with `--output-dir` routing all output to `workflow-hub-data/web-scraper/data`
- `workflow-data-repo` rule mandating a corresponding data folder in `workflow-hub-data` for every registry workflow, with symlink/routing conventions for scaffold and external-repo workflows
