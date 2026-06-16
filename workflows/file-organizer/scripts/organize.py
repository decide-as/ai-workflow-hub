#!/usr/bin/env python3
"""Organize a flat folder into category subfolders by file type.

Adapted from the `file_organizer` notebook into a runnable CLI so the desktop
hub can invoke it directly. Stdlib only — no third-party dependencies.

Usage:
    python3 organize.py <source_dir> [--dest DIR] [--execute] [--min-age-days N]

By default the script runs as a DRY RUN: it prints the full plan (what would
move where) and touches nothing. Pass --execute to actually move the files.

Safety guarantees (unchanged from the notebook):
  - Dry-run by default — preview before anything moves.
  - Never deletes files — content duplicates go to a Duplicates/ folder.
  - Empty (or OS-junk-only) folders are removed; everything else is moved.
  - Every executed run writes a log + JSON report into the destination folder.
"""

import argparse
import collections
import datetime
import hashlib
import json
import logging
import os
import re
import shutil
import sys
import time as _time
from pathlib import Path

# ── Configuration (static) ────────────────────────────────────────────────────

DUPLICATES_FOLDER_NAME = "Duplicates"

LOG_FILE_NAME = ".file_organizer_log.txt"
REPORT_FILE_NAME = ".file_organizer_report.json"

HASH_CHUNK_SIZE = 65536  # 64 KB

DATE_PREFIX_FORMAT = "%Y-%m-%d"
DATE_PREFIX_SEPARATOR = "_"

# Default name of the destination subfolder created inside the source folder.
DEFAULT_DEST_NAME = "__ORGANIZED__"

# Category name → list of extensions (lowercase, no dot).
# Order matters for overlapping extensions — first match wins.
CATEGORIES = {
    "Images": [
        "jpg",
        "jpeg",
        "png",
        "gif",
        "bmp",
        "svg",
        "webp",
        "ico",
        "tiff",
        "tif",
        "heic",
        "heif",
        "raw",
        "cr2",
        "nef",
        "arw",
        "avif",
    ],
    "PDF": ["pdf", "ps"],
    "Spreadsheets": ["xls", "xlsx", "xlsb", "csv", "ods", "numbers", "tsv"],
    "Text_Documents": ["doc", "docx", "txt", "rtf", "odt", "pages", "epub", "md"],
    "Presentations": ["ppt", "pptx", "odp", "key"],
    "Links": ["html", "htm", "webloc", "url"],
    "Photoshop": ["psd", "psb"],
    "Illustrator": ["ai", "dwg"],
    "InDesign": ["indd", "indt", "idml"],
    "BI": ["twb", "twbx", "tds", "tdsx", "hyper"],
    "Videos": [
        "mp4",
        "mkv",
        "avi",
        "mov",
        "wmv",
        "flv",
        "webm",
        "m4v",
        "mpg",
        "mpeg",
        "3gp",
    ],
    "Audio": ["mp3", "wav", "flac", "aac", "ogg", "wma", "m4a", "opus", "aiff"],
    "Archives": [
        "zip",
        "tar",
        "gz",
        "bz2",
        "xz",
        "7z",
        "rar",
        "tgz",
        "tar.gz",
        "tar.bz2",
        "tar.xz",
    ],
    "Calendar": ["ics"],
    "Code": [
        "py",
        "js",
        "ts",
        "css",
        "json",
        "xml",
        "yaml",
        "yml",
        "sh",
        "bash",
        "zsh",
        "rb",
        "java",
        "c",
        "cpp",
        "h",
        "go",
        "rs",
        "swift",
        "kt",
        "sql",
        "r",
        "ipynb",
        "geojson",
        "publishsettings",
        "pem",
        "pub",
        "pjpass",
    ],
    "Apps": ["app", "exe", "msi", "pkg", "deb", "rpm", "appimage", "dmg", "iso", "img"],
    "Fonts": ["ttf", "otf", "woff", "woff2", "eot"],
    "Folders": [],  # special: matches directories with no known extension
}

# ── Derived lookups (do not edit) ─────────────────────────────────────────────

EXT_TO_CATEGORY = {}
for _cat, _exts in CATEGORIES.items():
    for _ext in _exts:
        EXT_TO_CATEGORY.setdefault(_ext, _cat)

# Names that should never be moved (our own output + category folders).
_INTERNAL_FILES = {LOG_FILE_NAME, REPORT_FILE_NAME}
_CATEGORY_NAMES = set(CATEGORIES.keys()) | {"Other", DUPLICATES_FOLDER_NAME}

DATE_PREFIX_RE = re.compile(r"^\d{4}-\d{2}-\d{2}[_\- ]")

# Files macOS/Windows create automatically — treated as "junk" when deciding
# whether a folder is empty. These do NOT start with "." so the dot-file check
# alone won't catch them.
_JUNK_NAMES = {
    "Icon\r",
    "Icon\r\r",  # macOS custom-icon resource fork
    "Thumbs.db",  # Windows thumbnail cache
    "desktop.ini",  # Windows folder settings
    "__MACOSX",  # macOS archive artefact
    ".DS_Store",  # (also caught by dot-check, but listed for clarity)
}

logger = logging.getLogger("file_organizer")


# ── Utility functions ─────────────────────────────────────────────────────────


def file_hash(path: Path) -> str:
    """SHA-256 hash of a file, read in chunks to handle large files."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(HASH_CHUNK_SIZE):
            h.update(chunk)
    return h.hexdigest()


def get_extension_key(path: Path) -> str:
    """Return the extension key for category lookup.

    Handles compound extensions like .tar.gz by checking the last two suffixes
    first, then falling back to the final suffix alone.
    """
    suffixes = path.suffixes
    if len(suffixes) >= 2:
        compound = "".join(suffixes[-2:]).lstrip(".").lower()
        if compound in EXT_TO_CATEGORY:
            return compound
    if suffixes:
        return suffixes[-1].lstrip(".").lower()
    return ""


def get_category(path: Path) -> str:
    """Determine the category for a file based on its extension.

    Checks extension first — even for directories (e.g. .app bundles on macOS).
    Only falls back to "Folders" if the directory has no known extension.
    """
    ext = get_extension_key(path)
    if ext and ext in EXT_TO_CATEGORY:
        return EXT_TO_CATEGORY[ext]
    if path.is_dir():
        return "Folders"
    return "Other"


def get_date_prefix(path: Path) -> str:
    """Format the file's modification time as a date string."""
    mtime = os.path.getmtime(path)
    dt = datetime.datetime.fromtimestamp(mtime)
    return dt.strftime(DATE_PREFIX_FORMAT)


def has_date_prefix(filename: str) -> bool:
    """Check whether a filename already starts with a YYYY-MM-DD prefix."""
    return bool(DATE_PREFIX_RE.match(filename))


def build_target_name(path: Path) -> str:
    """Build the destination filename with a date prefix.

    If the file already has a date prefix, returns the original name unchanged.
    Directories are never date-prefixed.
    """
    name = path.name
    if path.is_dir():
        return name
    if has_date_prefix(name):
        return name
    prefix = get_date_prefix(path)
    return f"{prefix}{DATE_PREFIX_SEPARATOR}{name}"


def _stem_and_ext(path: Path) -> tuple[str, str]:
    """Split a path into stem and full extension, handling compound extensions.

    For 'archive.tar.gz' returns ('archive', '.tar.gz').
    For 'report.pdf' returns ('report', '.pdf').
    """
    suffixes = path.suffixes
    if len(suffixes) >= 2:
        compound = "".join(suffixes[-2:])
        if compound.lstrip(".").lower() in EXT_TO_CATEGORY:
            stem = path.name[: -len(compound)]
            return stem, compound
    return path.stem, path.suffix


def resolve_name_collision(target_path: Path, source_hash: str) -> tuple[Path, str]:
    """Handle the case where target_path already exists.

    Returns (resolved_path, status) where status is one of:
      - "content_duplicate": identical content already at destination
      - "renamed": different content, appended numeric suffix
      - "ok": no collision
    """
    if not target_path.exists():
        return target_path, "ok"

    existing_hash = file_hash(target_path)
    if existing_hash == source_hash:
        return target_path, "content_duplicate"

    # Different content — find a free name with numeric suffix.
    stem, ext = _stem_and_ext(target_path)
    counter = 1
    while True:
        candidate = target_path.parent / f"{stem}_{counter}{ext}"
        if not candidate.exists():
            return candidate, "renamed"
        if file_hash(candidate) == source_hash:
            return candidate, "content_duplicate"
        counter += 1


def _resolve_dup_path(dup_target_path: Path) -> Path:
    """Ensure the Duplicates/ target path doesn't collide with an existing file."""
    if not dup_target_path.exists():
        return dup_target_path
    stem, ext = _stem_and_ext(dup_target_path)
    counter = 1
    while True:
        candidate = dup_target_path.parent / f"{stem}_{counter}{ext}"
        if not candidate.exists():
            return candidate
        counter += 1


def scan_for_content_duplicates(file_list: list[Path]) -> dict[str, list[Path]]:
    """Find files with identical content, even if they have different names.

    Optimization: groups by file size first (files with unique sizes can't be
    duplicates), then only hashes files that share a size with at least one other.

    Returns: {sha256_hash: [path1, path2, ...]} for groups with 2+ files.
    """
    size_groups: dict[int, list[Path]] = collections.defaultdict(list)
    for p in file_list:
        try:
            size_groups[p.stat().st_size].append(p)
        except OSError:
            continue

    hash_groups: dict[str, list[Path]] = collections.defaultdict(list)
    for _size, paths in size_groups.items():
        if len(paths) < 2:
            continue
        for p in paths:
            try:
                hash_groups[file_hash(p)].append(p)
            except OSError:
                continue

    return {h: paths for h, paths in hash_groups.items() if len(paths) >= 2}


def _is_empty_dir(path: Path) -> bool:
    """Check if a directory is empty or contains only OS junk files."""
    if not path.is_dir():
        return False
    for child in path.iterdir():
        name = child.name
        if name.startswith("."):
            continue
        if name in _JUNK_NAMES:
            continue
        return False
    return True


def _should_skip(
    item: Path, ignore_folders: set[str], min_age_days: float
) -> str | None:
    """Return a skip reason if this item should not be organized, else None."""
    name = item.name
    if name.startswith("."):
        return "hidden file"
    if name in _INTERNAL_FILES:
        return "internal file"
    if item.is_dir() and name in ignore_folders:
        return "ignored folder"
    # Skip category folders from a previous run (only relevant if source == dest).
    if item.is_dir() and name in _CATEGORY_NAMES:
        return "existing category folder"
    if min_age_days > 0:
        try:
            stat = item.stat()
            created = getattr(stat, "st_birthtime", stat.st_ctime)
            age_days = (_time.time() - created) / 86400
            if age_days < min_age_days:
                return f"too recent (created {age_days:.1f} days ago, threshold: {min_age_days})"
        except OSError:
            pass
    return None


# ── Plan builder (core logic) ─────────────────────────────────────────────────


def build_organization_plan(
    source_dir: Path,
    dest_dir: Path,
    ignore_folders: set[str],
    min_age_days: float,
) -> dict:
    """Scan source_dir and build a plan to organize files into dest_dir.

    Returns a dict with: moves, content_duplicates, skipped, summary.
    """
    moves = []
    skipped = []
    all_files = []  # only regular files, for duplicate scanning

    items = sorted(source_dir.iterdir(), key=lambda p: p.name.lower())

    for item in items:
        reason = _should_skip(item, ignore_folders, min_age_days)
        if reason:
            skipped.append({"path": str(item), "reason": reason})
            continue

        # Empty directories get removed, not moved.
        if _is_empty_dir(item):
            moves.append(
                {
                    "source": str(item),
                    "destination": "",
                    "category": "Folders",
                    "action": "remove_empty",
                    "original_name": item.name,
                    "new_name": item.name,
                    "is_dir": True,
                    "note": "empty folder — will be removed",
                }
            )
            continue

        category = get_category(item)
        target_name = build_target_name(item)
        target_dir = dest_dir / category
        target_path = target_dir / target_name

        if item.is_file():
            all_files.append(item)

        move_entry = {
            "source": str(item),
            "destination": str(target_path),
            "category": category,
            "action": "move",
            "original_name": item.name,
            "new_name": target_name,
            "is_dir": item.is_dir(),
        }

        # For files, check name collisions at the target.
        if item.is_file() and target_path.exists():
            src_hash = file_hash(item)
            resolved_path, status = resolve_name_collision(target_path, src_hash)
            if status == "content_duplicate":
                dup_target_dir = dest_dir / DUPLICATES_FOLDER_NAME / category
                dup_target_path = _resolve_dup_path(dup_target_dir / target_name)
                move_entry["action"] = "move_to_duplicates"
                move_entry["destination"] = str(dup_target_path)
                move_entry["new_name"] = dup_target_path.name
                move_entry["note"] = (
                    f"identical content already at {resolved_path.name}"
                )
            elif status == "renamed":
                move_entry["action"] = "rename_move"
                move_entry["destination"] = str(resolved_path)
                move_entry["new_name"] = resolved_path.name
                move_entry["note"] = (
                    f"name collision resolved: {target_name} → {resolved_path.name}"
                )

        # For directories, check if a folder with the same name exists in target.
        if item.is_dir() and target_path.exists():
            counter = 1
            while True:
                candidate = target_path.parent / f"{target_name}_{counter}"
                if not candidate.exists():
                    move_entry["action"] = "rename_move"
                    move_entry["destination"] = str(candidate)
                    move_entry["new_name"] = candidate.name
                    move_entry["note"] = (
                        f"name collision: {target_name} → {candidate.name}"
                    )
                    break
                counter += 1

        moves.append(move_entry)

    # Scan for content duplicates among source files.
    content_dupes = scan_for_content_duplicates(all_files)

    # Redirect duplicate files to the Duplicates folder: keep the first file in
    # its normal location, redirect the rest to Duplicates/<category>/.
    for _h, paths in content_dupes.items():
        for dup_path in paths[1:]:
            for entry in moves:
                if entry["source"] == str(dup_path):
                    if entry["action"] == "move_to_duplicates":
                        break
                    cat = entry["category"]
                    dup_target_dir = dest_dir / DUPLICATES_FOLDER_NAME / cat
                    dup_target_path = _resolve_dup_path(
                        dup_target_dir / entry["new_name"]
                    )
                    entry["action"] = "move_to_duplicates"
                    entry["destination"] = str(dup_target_path)
                    entry["new_name"] = dup_target_path.name
                    entry["note"] = f"content duplicate of {paths[0].name}"
                    break

    summary = collections.Counter()
    for entry in moves:
        summary[entry["category"]] += 1

    return {
        "moves": moves,
        "content_duplicates": {
            h: [str(p) for p in paths] for h, paths in content_dupes.items()
        },
        "skipped": skipped,
        "summary": dict(summary.most_common()),
    }


# ── Plan display ──────────────────────────────────────────────────────────────


def display_plan(plan: dict, dry_run: bool) -> None:
    """Pretty-print the organization plan."""
    moves = plan["moves"]
    content_dupes = plan["content_duplicates"]
    skipped = plan["skipped"]
    summary = plan["summary"]

    total = sum(summary.values())
    print("=" * 70)
    print(f"  ORGANIZATION PLAN — {total} items to process")
    print("=" * 70)
    print()

    if summary:
        max_cat_len = max(len(c) for c in summary)
        for cat, count in summary.items():
            bar = "█" * min(count, 40)
            print(f"  {cat:<{max_cat_len}}  {count:>4}  {bar}")
        print()

    by_category = collections.defaultdict(list)
    for entry in moves:
        by_category[entry["category"]].append(entry)

    for cat in sorted(by_category):
        entries = by_category[cat]
        print(f"── {cat} ({len(entries)}) " + "─" * max(0, 55 - len(cat)))
        for e in entries:
            action_icon = {
                "move": "→",
                "rename_move": "→ (renamed)",
                "move_to_duplicates": "⇒ Duplicates/",
                "remove_empty": "✕ DELETE",
            }.get(e["action"], "?")

            src_name = e["original_name"]
            dst_name = e["new_name"]

            if e["action"] in ("move_to_duplicates", "remove_empty"):
                print(f"  {action_icon}  {src_name}")
                print(f"         {e.get('note', '')}")
            else:
                if src_name != dst_name:
                    print(f"  {action_icon}  {src_name}  ⟶  {dst_name}")
                else:
                    print(f"  {action_icon}  {src_name}")
                if "note" in e:
                    print(f"         {e['note']}")
        print()

    if content_dupes:
        print("── Content Duplicates Found " + "─" * 42)
        for i, (h, paths) in enumerate(content_dupes.items(), 1):
            print(f"  Group {i} (hash: {h[:12]}...):")
            for p in paths:
                print(f"    • {Path(p).name}")
            print(
                f"    → First file kept in normal location, others moved to {DUPLICATES_FOLDER_NAME}/"
            )
        print()

    if skipped:
        print(f"── Skipped ({len(skipped)}) " + "─" * 50)
        for s in skipped:
            print(f"  {Path(s['path']).name:<40} ({s['reason']})")
        print()

    other_entries = [e for e in moves if e["category"] == "Other"]
    if other_entries:
        other_exts = set()
        for e in other_entries:
            ext = Path(e["original_name"]).suffix.lstrip(".").lower()
            other_exts.add(ext if ext else "(no extension)")
        print("── Uncategorized extensions in Other " + "─" * 33)
        print(f"  {', '.join(sorted(other_exts))}")
        print("  Add these to CATEGORIES to sort them into the right folder.")
        print()

    if dry_run:
        print("=" * 70)
        print("  ⚠  DRY RUN — no files were moved.")
        print("  Click 'Apply moves' to execute this plan.")
        print("=" * 70)


# ── Executor ──────────────────────────────────────────────────────────────────


def execute_plan(plan: dict, source_dir: Path, dest_dir: Path, dry_run: bool) -> None:
    """Execute the organization plan, or just display it if dry_run is True."""
    display_plan(plan, dry_run)

    if dry_run:
        return

    moves = plan["moves"]
    succeeded = 0
    removed = 0
    failed = 0
    report_entries = []

    logger.info(f"Executing organization plan: {len(moves)} operations")

    for entry in moves:
        src = Path(entry["source"])
        action = entry["action"]

        if action == "remove_empty":
            try:
                shutil.rmtree(str(src))
                logger.info(f"REMOVED empty folder: {src.name}")
                removed += 1
                report_entries.append({**entry, "result": "removed"})
            except OSError as e:
                logger.error(f"FAIL remove {src.name}: {e}")
                failed += 1
                report_entries.append({**entry, "result": f"error: {e}"})
            continue

        dst = Path(entry["destination"])

        try:
            dst.parent.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            logger.error(f"FAIL mkdir {dst.parent}: {e}")
            failed += 1
            report_entries.append({**entry, "result": f"error: {e}"})
            continue

        try:
            shutil.move(str(src), str(dst))
            logger.info(f"MOVED: {src.name} → {dst}")
            succeeded += 1
            report_entries.append({**entry, "result": "moved"})
        except (OSError, shutil.Error) as e:
            logger.error(f"FAIL: {src.name} → {dst}: {e}")
            failed += 1
            report_entries.append({**entry, "result": f"error: {e}"})

    print()
    print("=" * 70)
    parts = [f"{succeeded} moved"]
    if removed:
        parts.append(f"{removed} empty folder(s) removed")
    if failed:
        parts.append(f"{failed} failed")
    print(f"  DONE — {', '.join(parts)}")
    print("=" * 70)
    logger.info(f"Complete: {', '.join(parts)}")

    report_path = dest_dir / REPORT_FILE_NAME
    report = {
        "timestamp": datetime.datetime.now().isoformat(),
        "source_dir": str(source_dir),
        "dest_dir": str(dest_dir),
        "dry_run": dry_run,
        "operations": report_entries,
        "content_duplicates": plan["content_duplicates"],
        "summary": {
            "succeeded": succeeded,
            "removed_empty": removed,
            "failed": failed,
        },
    }
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\n  Report saved to: {report_path}")


def _setup_execution_logging(dest_dir: Path) -> None:
    """Console + file logging for a real (executing) run."""
    logger.setLevel(logging.DEBUG)
    logger.handlers.clear()

    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)
    ch.setFormatter(logging.Formatter("%(levelname)-8s %(message)s"))
    logger.addHandler(ch)

    fh = logging.FileHandler(dest_dir / LOG_FILE_NAME, mode="a", encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(logging.Formatter("%(asctime)s | %(levelname)-8s | %(message)s"))
    logger.addHandler(fh)


# ── Entry point ───────────────────────────────────────────────────────────────


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Organize a flat folder into category subfolders by file type.",
    )
    parser.add_argument("source", help="Folder to organize (e.g. ~/Downloads)")
    parser.add_argument(
        "--dest",
        default=None,
        help=f"Destination folder (default: <source>/{DEFAULT_DEST_NAME})",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually move files. Without this flag the script is a dry run.",
    )
    parser.add_argument(
        "--min-age-days",
        type=float,
        default=0,
        help="Only move items at least this many days old (0 = move everything).",
    )
    args = parser.parse_args(argv)

    source_dir = Path(args.source).expanduser().resolve()
    if not source_dir.is_dir():
        print(
            f"ERROR: source folder not found or not a directory: {source_dir}",
            file=sys.stderr,
        )
        return 2

    dest_dir = (
        Path(args.dest).expanduser().resolve()
        if args.dest
        else source_dir / DEFAULT_DEST_NAME
    )

    # Always ignore our own destination folder, plus the default name, so a
    # re-run never tries to reorganize previously organized files.
    ignore_folders = {DEFAULT_DEST_NAME, dest_dir.name}

    dry_run = not args.execute

    print(f"Source directory : {source_dir}")
    print(f"Dest directory   : {dest_dir}")
    print(f"Mode             : {'DRY RUN (preview)' if dry_run else 'EXECUTE'}")
    print(f"Min age (days)   : {args.min_age_days}")
    print()

    if not dry_run:
        dest_dir.mkdir(parents=True, exist_ok=True)
        _setup_execution_logging(dest_dir)
        logger.info(f"Logger initialized — log file: {dest_dir / LOG_FILE_NAME}")

    plan = build_organization_plan(
        source_dir, dest_dir, ignore_folders, args.min_age_days
    )
    execute_plan(plan, source_dir, dest_dir, dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
