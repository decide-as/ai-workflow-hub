"""Shared aggregation for retro analyzers.

Commit sampling, adaptive time-period granularity, period slot generation,
score/activity aggregation and normalization, and header grouping.
"""

from __future__ import annotations

import calendar
import datetime
import sys
from collections import defaultdict
from typing import Any

from retro_git import git

MAX_COMMITS_PER_MONTH = 15


def get_sampled_commits(repo_root: str, since: str, until: str) -> list[dict[str, str]]:
    """Get sampled commits grouped by month, returning sha/date/subject."""
    output = git(
        [
            "log",
            "--all",
            "--format=%H %ad %s",
            "--date=short",
            f"--since={since}",
            f"--until={until}",
            "--no-merges",
            "--reverse",
        ],
        repo_root,
        timeout=30,
    )

    if not output:
        return []

    commits: list[dict[str, str]] = []
    for line in output.split("\n"):
        if not line.strip():
            continue
        parts = line.split(" ", 2)
        if len(parts) < 2:
            continue
        sha = parts[0]
        date = parts[1]  # YYYY-MM-DD
        subject = parts[2] if len(parts) > 2 else ""
        month = date[:7]  # YYYY-MM
        commits.append(
            {
                "sha": sha,
                "date": date,
                "subject": subject,
                "month": month,
            }
        )

    if not commits:
        return []

    # Group by month and sample
    months: dict[str, list[dict[str, str]]] = defaultdict(list)
    for c in commits:
        months[c["month"]].append(c)

    sampled: list[dict[str, str]] = []
    for month_key in sorted(months.keys()):
        month_commits = months[month_key]
        if len(month_commits) <= MAX_COMMITS_PER_MONTH:
            sampled.extend(month_commits)
        else:
            # Sample: first, last, and evenly spaced in between
            indices = [0, len(month_commits) - 1]
            step = (len(month_commits) - 1) / (MAX_COMMITS_PER_MONTH - 1)
            for i in range(1, MAX_COMMITS_PER_MONTH - 1):
                idx = round(i * step)
                if idx not in indices:
                    indices.append(idx)
            indices.sort()
            for idx in indices:
                sampled.append(month_commits[idx])

    # Ensure first and last are always included
    if commits and sampled and sampled[0]["sha"] != commits[0]["sha"]:
        sampled.insert(0, commits[0])
    if commits and sampled and sampled[-1]["sha"] != commits[-1]["sha"]:
        sampled.append(commits[-1])

    return sampled


def build_header_groups(
    period_commits: list[dict[str, str]],
    granularity: str,
) -> list[dict[str, Any]]:
    """Group period columns under header spans.

    Header grouping adapts to granularity:
        day/week  → group by month (e.g., "Mar 2026")
        month     → group by year (e.g., "2026")
        quarter   → group by year (e.g., "2026")
    """
    month_names = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ]

    def _header_key(c: dict[str, str]) -> str:
        date = c["date"]
        if granularity in ("day", "week"):
            return date[:7]  # YYYY-MM
        return date[:4]  # YYYY

    def _header_label(key: str) -> str:
        if granularity in ("day", "week"):
            parts = key.split("-")
            return f"{month_names[int(parts[1]) - 1]} {parts[0]}"
        return key  # year

    groups: dict[str, list[dict[str, str]]] = defaultdict(list)
    group_order: list[str] = []
    for c in period_commits:
        key = _header_key(c)
        if key not in groups:
            group_order.append(key)
        groups[key].append(c)

    return [
        {
            "label": _header_label(key),
            "commits": [
                {
                    "sha": c.get("sha", ""),
                    "date": c["date"],
                    "label": c.get("label", ""),
                    "subject": c.get("subject", ""),
                }
                for c in groups[key]
            ],
        }
        for key in group_order
    ]


def determine_granularity(start: datetime.date, end: datetime.date) -> str:
    """Choose column granularity based on the span between start and end dates.

    Rules:
        <= 30 days   → "day"
        <= 30 weeks  → "week"
        <= 30 months → "month"
        > 30 months  → "quarter"
    """
    span_days = (end - start).days
    if span_days <= 30:
        return "day"
    if span_days <= 30 * 7:
        return "week"
    if span_days <= 30 * 30:
        return "month"
    return "quarter"


def generate_period_slots(
    start: datetime.date, end: datetime.date, granularity: str
) -> list[tuple[str, datetime.date, datetime.date]]:
    """Generate contiguous (label, period_start, period_end) slots.

    Each slot covers a non-overlapping time range from start through end.
    """
    slots: list[tuple[str, datetime.date, datetime.date]] = []

    if granularity == "day":
        current = start
        while current <= end:
            label = str(current.day)
            slots.append((label, current, current))
            current += datetime.timedelta(days=1)

    elif granularity == "week":
        # Weeks start on Monday. First slot starts on `start` regardless.
        current = start
        while current <= end:
            week_end = current + datetime.timedelta(days=6)
            if week_end > end:
                week_end = end
            label = f"{current.month}/{current.day}"
            slots.append((label, current, week_end))
            current = week_end + datetime.timedelta(days=1)

    elif granularity == "month":
        current = start.replace(day=1)
        while current <= end:
            last_day = calendar.monthrange(current.year, current.month)[1]
            month_end = current.replace(day=last_day)
            if month_end > end:
                month_end = end
            month_start = max(current, start)
            month_names = [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "May",
                "Jun",
                "Jul",
                "Aug",
                "Sep",
                "Oct",
                "Nov",
                "Dec",
            ]
            label = f"{month_names[current.month - 1]}"
            slots.append((label, month_start, month_end))
            # Advance to next month
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1, day=1)
            else:
                current = current.replace(month=current.month + 1, day=1)

    elif granularity == "quarter":
        # Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec
        q_month = ((start.month - 1) // 3) * 3 + 1
        current = start.replace(month=q_month, day=1)
        while current <= end:
            q_num = (current.month - 1) // 3 + 1
            q_end_month = q_num * 3
            last_day = calendar.monthrange(current.year, q_end_month)[1]
            q_end = datetime.date(current.year, q_end_month, last_day)
            if q_end > end:
                q_end = end
            q_start = max(current, start)
            label = f"Q{q_num} {current.year}"
            slots.append((label, q_start, q_end))
            # Advance to next quarter
            if q_end_month >= 12:
                current = datetime.date(current.year + 1, 1, 1)
            else:
                current = datetime.date(current.year, q_end_month + 1, 1)

    return slots


def aggregate_by_period(
    sampled: list[dict[str, str]],
    raw_scores: dict[str, dict[str, float]],
    raw_activity: dict[str, dict[str, int]],
    end_date: str,
) -> tuple[
    list[dict[str, str]],
    dict[str, dict[str, float]],
    dict[str, dict[str, int]],
    str,
]:
    """Aggregate per-commit data into contiguous time-period columns.

    Granularity is auto-selected based on span:
        <= 30 days   → per-day columns
        <= 30 weeks  → per-week columns
        <= 30 months → per-month columns
        > 30 months  → per-quarter columns

    For each period:
    - Completeness (scores): last commit's score within the period.
      Inactive periods carry forward the previous period's score.
    - Activity: sum of changes across all commits in the period.
      Inactive periods = 0.

    After aggregation, scores are normalized per-feature (peak = 10.0) and
    activity is normalized per-feature (largest period = 100).

    Returns:
        (period_commits, normalized_scores, normalized_activity, granularity)
    """

    # Group commits by date
    day_groups: dict[str, list[dict[str, str]]] = {}
    for c in sampled:
        date = c["date"]
        if date not in day_groups:
            day_groups[date] = []
        day_groups[date].append(c)

    first_date = sampled[0]["date"]
    start = datetime.date.fromisoformat(first_date)
    end = datetime.date.fromisoformat(end_date)

    granularity = determine_granularity(start, end)
    slots = generate_period_slots(start, end, granularity)

    print(f"[--] Granularity: {granularity} ({len(slots)} columns)", file=sys.stderr)

    # For each slot, collect the commits that fall within it
    all_fids = list(raw_scores.keys())
    period_commits: list[dict[str, str]] = []
    period_keys: list[str] = []

    period_scores_raw: dict[str, dict[str, float]] = {fid: {} for fid in all_fids}
    period_activity_raw: dict[str, dict[str, int]] = {fid: {} for fid in raw_activity}

    prev_scores: dict[str, float] = dict.fromkeys(all_fids, 0.0)

    for label, p_start, p_end in slots:
        # Collect all commits in this period
        period_day_commits: list[dict[str, str]] = []
        current = p_start
        while current <= p_end:
            d = current.isoformat()
            if d in day_groups:
                period_day_commits.extend(day_groups[d])
            current += datetime.timedelta(days=1)

        # Build key and representative commit for this period
        if period_day_commits:
            last = period_day_commits[-1]
            key = last["sha"][:8]
            period_commits.append(
                {
                    "sha": key,
                    "date": p_start.isoformat(),
                    "label": label,
                    "subject": last["subject"],
                    "month": p_start.isoformat()[:7],
                }
            )
        else:
            key = f"p-{p_start.isoformat()}"
            period_commits.append(
                {
                    "sha": key,
                    "date": p_start.isoformat(),
                    "label": label,
                    "subject": "",
                    "month": p_start.isoformat()[:7],
                }
            )
        period_keys.append(key)

        # Scores: take last commit's raw score, or carry forward
        if period_day_commits:
            last_sha = period_day_commits[-1]["sha"]
            for fid in all_fids:
                val = raw_scores[fid].get(last_sha, 0.0)
                period_scores_raw[fid][key] = val
                prev_scores[fid] = val
        else:
            for fid in all_fids:
                period_scores_raw[fid][key] = prev_scores[fid]

        # Activity: sum all commits in period
        for fid in raw_activity:
            total = sum(raw_activity[fid].get(c["sha"], 0) for c in period_day_commits)
            period_activity_raw[fid][key] = total

    # Normalize scores per-feature (peak = 10.0)
    normalized_scores: dict[str, dict[str, float]] = {}
    for fid in period_scores_raw:
        vals = period_scores_raw[fid]
        peak = max(vals.values()) if vals else 1.0
        if peak == 0:
            peak = 1.0
        normalized_scores[fid] = {
            key: round(raw / peak * 10.0, 1) for key, raw in vals.items()
        }

    # Normalize activity per-feature (largest period = 100)
    normalized_activity: dict[str, dict[str, int]] = {}
    for fid in period_activity_raw:
        act_vals = period_activity_raw[fid]
        feature_max = max(act_vals.values()) if act_vals else 1
        if feature_max == 0:
            feature_max = 1
        normalized_activity[fid] = {
            key: round(churn / feature_max * 100) for key, churn in act_vals.items()
        }

    return period_commits, normalized_scores, normalized_activity, granularity
