#!/usr/bin/env python3
"""
Finn.no Job Auto-Tracker

Runs every 15 minutes via launchd. Scrapes the first page of Finn.no job
search results, scores new positions using the job-tracker evaluation system,
stores qualifying results in the job-tracker SQLite DB, and sends Pushover
notifications for high-scoring positions.

Thresholds:
  score < 50%   → skip entirely (recorded in dedup log only)
  score >= 50%  → store in job-tracker DB + write output files
  score >= 60%  → also send Pushover notification
"""

import json
import logging
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Optional

# ── Paths ───────────────────────────────────────────────────────────────────
# The script lives at workflow-hub/scripts/finn-job-tracker.py both in the
# main repo and in worktrees. Always resolve .env from the canonical main repo.
WORKFLOW_HUB = Path.home() / "Repositories" / "workflow-hub"
JOB_TRACKER_REPO = Path.home() / "Repositories" / "job-tracker"
WORKFLOW_HUB_DATA = Path.home() / "Repositories" / "workflow-hub-data"

DEDUP_LOG = WORKFLOW_HUB_DATA / "job-strategy" / "data" / "auto-scraped.json"
LOG_DIR = WORKFLOW_HUB / "logs"
LOG_FILE = LOG_DIR / "finn-job-tracker.log"
ENV_FILE = WORKFLOW_HUB / ".env"

CLAUDE_BIN = Path.home() / ".local" / "bin" / "claude"

# ── Config ───────────────────────────────────────────────────────────────────
FINN_SEARCH_URL = (
    "https://www.finn.no/job/search"
    "?location=1.20001.20061"
    "&location=1.20001.20003"
    "&location=1.20001.20007"
    "&q=ai"
    "&sort=PUBLISHED_DESC"
)
SCORE_STORE_THRESHOLD = 50
SCORE_NOTIFY_THRESHOLD = 60
PUSHOVER_API_URL = "https://api.pushover.net/1/messages.json"
HTTP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "no,en;q=0.9",
}


# ── Bootstrap ────────────────────────────────────────────────────────────────


def load_env():
    if not ENV_FILE.exists():
        return
    with open(ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, _, val = line.partition("=")
                val = val.strip().strip('"').strip("'")
                os.environ.setdefault(key.strip(), val)


def setup_logging():
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[
            logging.FileHandler(LOG_FILE),
            logging.StreamHandler(sys.stdout),
        ],
    )


def _add_job_tracker_to_path():
    path = str(JOB_TRACKER_REPO)
    if path not in sys.path:
        sys.path.insert(0, path)


# ── Dedup log ────────────────────────────────────────────────────────────────


def load_dedup_log() -> dict:
    DEDUP_LOG.parent.mkdir(parents=True, exist_ok=True)
    if DEDUP_LOG.exists():
        try:
            return json.loads(DEDUP_LOG.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass
    return {}


def save_dedup_log(log: dict):
    DEDUP_LOG.write_text(
        json.dumps(log, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def mark_dedup(
    log: dict,
    finn_id: str,
    status: str,
    score: Optional[int] = None,
    url: str = None,
    title: str = None,
    company: str = None,
):
    log[finn_id] = {
        "finn_id": finn_id,
        "url": url,
        "title": title,
        "company": company,
        "status": status,
        "score": score,
        "scraped_at": datetime.now().isoformat(),
    }


def url_already_in_db(url: str) -> Optional[str]:
    """Return existing app_number if URL is already in job-tracker DB, else None."""
    _add_job_tracker_to_path()
    try:
        import src.db as db

        conn = db.get_connection()
        row = conn.execute(
            "SELECT app_number FROM applications WHERE url = ?", (url,)
        ).fetchone()
        conn.close()
        return row["app_number"] if row else None
    except Exception as e:
        logging.warning(f"  Could not check DB for existing URL: {e}")
        return None


# ── Finn.no scraping ──────────────────────────────────────────────────────────


def _fetch_stdlib(url: str) -> str:
    req = urllib.request.Request(url, headers=HTTP_HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


MAX_LISTINGS_PER_RUN = 25


def extract_all_listings(html: str) -> dict[str, dict]:
    """Extract title, company, and published ISO date for the first 25 jobs on the page.

    Parses the job card HTML structure where:
    - title: text after hidden <span> in the <a job-card-link> element
    - company: text inside the first <strong> after the title link
    - published: ISO datetime from the <time dateTime="..."> element
    """
    result = {}
    for m in re.finditer(
        r'href="(?:https://www\.finn\.no)?/job/(?:[a-z]+/)?ad/(\d+)"', html
    ):
        if len(result) >= MAX_LISTINGS_PER_RUN:
            break
        finn_id = m.group(1)
        if finn_id in result:
            continue
        window = html[m.start() : m.start() + 1200]

        title_m = re.search(r"</span>(.*?)</a>", window, re.DOTALL)
        title = re.sub(r"<[^>]+>", "", title_m.group(1)).strip() if title_m else None

        company_m = re.search(r"<strong>(.*?)</strong>", window, re.DOTALL)
        company = (
            re.sub(r"<[^>]+>", "", company_m.group(1)).strip() if company_m else None
        )

        date_m = re.search(r'dateTime="([^"]+)"', window)
        published = date_m.group(1) if date_m else None

        result[finn_id] = {"title": title, "company": company, "published": published}
    return result


def finn_job_url(finn_id: str) -> str:
    return f"https://www.finn.no/job/ad/{finn_id}"


def fetch_job_posting(url: str) -> str:
    """Fetch a job posting using ScrapingBee (via job-tracker) or stdlib fallback."""
    _add_job_tracker_to_path()
    from src.scraper import fetch_posting

    return fetch_posting(url)


def extract_title_company_from_text(text: str) -> tuple[Optional[str], Optional[str]]:
    """Heuristic: extract job title and company from first non-empty lines."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    title = lines[0] if lines else None
    company = lines[1] if len(lines) > 1 else None
    return title, company


# ── Scoring ───────────────────────────────────────────────────────────────────


def score_posting(posting_text: str, url: str) -> tuple[Optional[int], str, dict]:
    """Score a job posting via claude -p.

    Returns (score_pct, raw_llm_output, scores_dict).
    Returns (None, "", {}) on failure.
    """
    _add_job_tracker_to_path()
    from src.scorer import build_evaluation_prompt, parse_scores
    from src.ranker import calculate_scores

    prompt = build_evaluation_prompt(posting_text, url)

    try:
        result = subprocess.run(
            [str(CLAUDE_BIN), "-p", "--model", "sonnet", "--no-session-persistence"],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=360,
        )
    except subprocess.TimeoutExpired:
        logging.error("  claude -p timed out after 6 minutes")
        return None, "", {}
    except FileNotFoundError:
        logging.error(f"  claude binary not found at {CLAUDE_BIN}")
        return None, "", {}

    if result.returncode != 0:
        logging.error(
            f"  claude -p failed (rc={result.returncode}): {result.stderr[:300]}"
        )
        return None, "", {}

    raw_output = result.stdout
    scores = parse_scores(raw_output)
    calc = calculate_scores(scores)
    return calc["total_pct"], raw_output, scores


# ── Storage ───────────────────────────────────────────────────────────────────


def store_in_job_tracker(
    url: str, posting_text: str, raw_output: str, title: str, company: str
) -> Optional[str]:
    """Store evaluated job in job-tracker DB and write output files.

    Returns app_number on success, None if already exists or on error.
    """
    _add_job_tracker_to_path()
    import src.db as db
    from src.scorer import parse_scores, parse_evaluation_sections
    from src.ranker import calculate_scores, rank_application
    from src.reporter import get_output_dir, write_all_outputs

    # Duplicate check
    existing = url_already_in_db(url)
    if existing:
        logging.info(f"  Already in DB as App #{existing}, skipping store")
        return existing

    scores = parse_scores(raw_output)
    calc = calculate_scores(scores)
    sections = parse_evaluation_sections(raw_output)

    app_id = db.insert_application(
        company=company,
        role_title=title,
        url=url,
        posting_text=posting_text,
    )
    app_number = db.get_app_number(app_id)

    db.insert_scores(app_id, scores)
    db.insert_evaluation(
        app_id,
        synthesis=sections.get("synthesis", ""),
        rejection_risks=sections.get("rejection_risks", ""),
        cv_guidance=sections.get("cv_guidance", ""),
        interview_questions=sections.get("interview_questions", ""),
        raw_output=raw_output,
    )
    rank_application(app_id, scores)

    output_dir = get_output_dir(app_number, company, title)
    app_meta = {
        "app_number": app_number,
        "company": company,
        "role": title,
        "url": url,
        "auto_scraped": True,
        "scraped_at": datetime.now().isoformat(),
    }
    write_all_outputs(
        output_dir,
        company,
        title,
        url,
        scores,
        calc,
        sections,
        raw_output=raw_output,
        app_meta=app_meta,
    )

    logging.info(
        f"  Stored as App #{app_number}: {company} — {title} ({calc['total_pct']}%)"
    )
    return app_number


# ── Notifications ─────────────────────────────────────────────────────────────


def send_pushover(
    company: str, title: str, score: int, url: str, published: Optional[str]
):
    token = os.environ.get("PUSHOVER_APP", "")
    user = os.environ.get("PUSHOVER_USER", "")
    if not token or not user:
        logging.warning("  Pushover credentials missing (PUSHOVER_APP / PUSHOVER_USER)")
        return

    pub_str = f"\nPublished: {published}" if published else ""
    message = f"Score: {score}%{pub_str}\n{url}"

    data = urllib.parse.urlencode(
        {
            "token": token,
            "user": user,
            "title": f"Job Match: {company} — {title}",
            "message": message,
            "priority": 0,
        }
    ).encode()

    req = urllib.request.Request(PUSHOVER_API_URL, data=data)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            logging.info(f"  Pushover sent (HTTP {resp.status})")
    except Exception as e:
        logging.error(f"  Pushover failed: {e}")


# ── Main ──────────────────────────────────────────────────────────────────────


def main():
    load_env()
    setup_logging()
    logging.info("── Finn.no auto-tracker run started ──")

    dedup = load_dedup_log()

    # Fetch first page of search results
    try:
        search_html = _fetch_stdlib(FINN_SEARCH_URL)
    except Exception as e:
        logging.error(f"Failed to fetch Finn.no search page: {e}")
        return

    listings = extract_all_listings(search_html)
    logging.info(f"Found {len(listings)} job IDs on search page")

    new_count = 0
    for finn_id, meta in listings.items():
        url = finn_job_url(finn_id)

        # Skip if already processed by this tracker
        if finn_id in dedup:
            continue

        # Skip if already in job-tracker DB (manually evaluated)
        existing = url_already_in_db(url)
        if existing:
            logging.info(
                f"Job {finn_id} already in DB as App #{existing}, marking seen"
            )
            mark_dedup(dedup, finn_id, "already_in_db", url=url)
            save_dedup_log(dedup)
            continue

        logging.info(f"New job: {finn_id} — {url}")
        new_count += 1

        # Fetch full job posting
        try:
            posting_text = fetch_job_posting(url)
        except Exception as e:
            logging.error(f"  Failed to fetch posting: {e}")
            mark_dedup(dedup, finn_id, "fetch_failed", url=url)
            save_dedup_log(dedup)
            continue

        if len(posting_text) < 200:
            logging.warning(
                f"  Posting text very short ({len(posting_text)} chars), may be empty page"
            )

        # Get title/company — prefer search page metadata, fall back to posting text
        title = meta.get("title")
        company = meta.get("company")
        if not title or not company:
            t, c = extract_title_company_from_text(posting_text)
            title = title or t or "Unknown Role"
            company = company or c or "Unknown Company"

        # Score
        logging.info(f"  Scoring: {company} — {title}")
        score_pct, raw_output, _scores = score_posting(posting_text, url)

        if score_pct is None:
            logging.error("  Scoring failed")
            mark_dedup(
                dedup, finn_id, "score_failed", url=url, title=title, company=company
            )
            save_dedup_log(dedup)
            continue

        logging.info(f"  Score: {score_pct}%")

        if score_pct < SCORE_STORE_THRESHOLD:
            logging.info(f"  Below {SCORE_STORE_THRESHOLD}% threshold, not storing")
            mark_dedup(
                dedup,
                finn_id,
                "below_threshold",
                score=score_pct,
                url=url,
                title=title,
                company=company,
            )
        else:
            store_in_job_tracker(url, posting_text, raw_output, title, company)
            mark_dedup(
                dedup,
                finn_id,
                "stored",
                score=score_pct,
                url=url,
                title=title,
                company=company,
            )

            if score_pct >= SCORE_NOTIFY_THRESHOLD:
                logging.info(f"  Score >= {SCORE_NOTIFY_THRESHOLD}%, sending Pushover")
                send_pushover(company, title, score_pct, url, meta.get("published"))

        save_dedup_log(dedup)

    if new_count == 0:
        logging.info("No new jobs found this run")
    logging.info(f"── Run complete ({new_count} new jobs processed) ──\n")


if __name__ == "__main__":
    main()
