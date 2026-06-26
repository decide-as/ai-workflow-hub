#!/usr/bin/env python3
"""
v3 clustering: 768-dim dense embeddings (paraphrase-multilingual-mpnet-base-v2)
+ LLM-synthesised folder labels via Ollama text inference.
Run with lanserbart venv: /Users/christianbraathen/Repositories/lanserbart/.venv/bin/python3
"""

import json
import shutil
import random
import re
import urllib.request
from pathlib import Path
from datetime import datetime

import numpy as np
from sentence_transformers import SentenceTransformer

FOLDER = Path("/Users/christianbraathen/My Drive/96 Screenshots/")
STATE_FILE = FOLDER / ".organizer-state.json"
LOG_FILE = FOLDER / ".organizer-log.txt"

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"
OLLAMA = "http://localhost:11434"
OLLAMA_MODEL = "qwen3-vl:8b"
LABEL_MODEL = "llama3.2:1b"  # fast text-only model for labeling; no thinking overhead

MIN_CLUSTER_SIZE = 5
OUTLIER_SIGMA = 1.5
MAX_K = 12

LABEL_PROMPT = """File organiser task. Given image descriptions, output EXACTLY ONE folder name.
Rules: 2-4 words, lowercase, hyphens, no explanation.
Examples: flight-booking, banking-auth, interior-design, financial-reports

Descriptions:
{descriptions}

Folder name:"""


def log(msg):
    print(msg, flush=True)


def sanitize(label):
    label = re.sub(r"<[^>]+>", "", label)  # strip tags
    label = re.sub(r"[^\w\s-]", "", label.lower()).strip()
    label = re.sub(r"\s+", "-", label)
    label = re.sub(r"-+", "-", label)
    return label[:40].strip("-")


def image_text(r):
    return f"{r['description']}. {', '.join(r['keywords'])}"


# ── Embeddings ────────────────────────────────────────────────────────────────


def build_embeddings(analyzed, paths):
    log(f"Loading embedding model: {MODEL_NAME}")
    model = SentenceTransformer(MODEL_NAME)
    texts = [image_text(analyzed[p]) for p in paths]
    log(f"Embedding {len(texts)} images...")
    embeddings = model.encode(
        texts,
        batch_size=32,
        show_progress_bar=True,
        normalize_embeddings=True,
        convert_to_numpy=True,
    ).astype(np.float32)
    log(f"Embeddings shape: {embeddings.shape}")
    return embeddings


# ── k-means ───────────────────────────────────────────────────────────────────


def cosine_dist_np(a, b):
    return float(1.0 - np.dot(a, b))


def kmeans_pp(embeddings, k):
    n = len(embeddings)
    idx = random.randint(0, n - 1)
    seeds = [embeddings[idx]]
    while len(seeds) < k:
        # dot product matrix (normalized vecs) = cosine similarities
        sims = embeddings @ np.array(seeds).T  # [N, len(seeds)]
        max_sims = sims.max(axis=1)
        dists = 1.0 - max_sims
        dists = np.maximum(dists, 0)
        total = dists.sum()
        if total == 0:
            seeds.append(embeddings[random.randint(0, n - 1)])
            continue
        probs = dists / total
        chosen = np.random.choice(n, p=probs)
        seeds.append(embeddings[chosen])
    return np.array(seeds)


def kmeans(embeddings, k, max_iter=100):
    centroids = kmeans_pp(embeddings, k)
    n = len(embeddings)
    assignments = np.zeros(n, dtype=int)

    for _ in range(max_iter):
        # Cosine similarity = dot product on normalized vecs
        sims = embeddings @ centroids.T  # [N, k]
        new_asgn = sims.argmax(axis=1)
        if np.array_equal(new_asgn, assignments):
            break
        assignments = new_asgn
        for c in range(k):
            members = embeddings[assignments == c]
            if len(members) > 0:
                c_vec = members.mean(axis=0)
                norm = np.linalg.norm(c_vec)
                centroids[c] = c_vec / norm if norm > 0 else c_vec

    return assignments, centroids


def silhouette(embeddings, assignments, k):
    n = len(embeddings)
    # Pairwise distances via dot product
    sims = embeddings @ embeddings.T
    dists = np.maximum(1.0 - sims, 0)
    total = 0.0
    for i in range(n):
        ci = assignments[i]
        same_mask = assignments == ci
        same_mask[i] = False
        same = dists[i][same_mask]
        a = same.mean() if len(same) > 0 else 0.0
        b = float("inf")
        for c in range(k):
            if c == ci:
                continue
            other = dists[i][assignments == c]
            if len(other) > 0:
                b = min(b, other.mean())
        s = (b - a) / max(a, b) if b != float("inf") else 0.0
        total += s
    return total / n


# ── Outlier detection ─────────────────────────────────────────────────────────


def detect_outliers(embeddings, assignments, centroids, sigma=OUTLIER_SIGMA):
    k = len(centroids)
    outliers = set()
    for c in range(k):
        mask = assignments == c
        idxs = np.where(mask)[0]
        if len(idxs) < 3:
            continue
        sims = embeddings[idxs] @ centroids[c]
        dists = 1.0 - sims
        mean, std = dists.mean(), dists.std()
        threshold = mean + sigma * std
        for pos, i in enumerate(idxs):
            if dists[pos] > threshold:
                outliers.add(int(i))
    return outliers


# ── LLM label synthesis ───────────────────────────────────────────────────────


def llm_label(member_paths, analyzed, cluster_idx):
    # Use a lightweight non-thinking model (llama3.2:1b) for fast labeling.
    # qwen3-vl:8b has thinking tokens that exhaust num_predict before producing output.
    descs = []
    for p in member_paths[:15]:
        d = analyzed[p]["description"][:150]
        descs.append(d)
    prompt = LABEL_PROMPT.format(descriptions="\n".join(f"- {d}" for d in descs))

    body = json.dumps(
        {
            "model": LABEL_MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.1, "num_predict": 40},
        }
    ).encode()
    req = urllib.request.Request(
        f"{OLLAMA}/api/generate",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = json.loads(r.read())["response"].strip()
        label = raw.split("\n")[0].strip().strip("\"'.,").strip()
        label = sanitize(label)
        if label and len(label) > 2:
            return label
    except Exception as e:
        log(f"  LLM label error for cluster {cluster_idx}: {e}")
    return f"cluster-{cluster_idx}"


# ── Main ──────────────────────────────────────────────────────────────────────


def main():
    state = json.loads(STATE_FILE.read_text())
    analyzed = state.get("analyzed", {})
    log(f"Loaded {len(analyzed)} analyzed images")

    # Discover all images (may be in subfolders from previous run)
    all_image_paths = {}
    for ext in ("*.png", "*.jpg", "*.jpeg", "*.webp", "*.gif"):
        for f in FOLDER.rglob(ext):
            if f.name.startswith("."):
                continue
            for orig_path, r in analyzed.items():
                if Path(orig_path).name == f.name and orig_path not in all_image_paths:
                    all_image_paths[orig_path] = {"result": r, "current": str(f)}
                    break

    log(f"Found {len(all_image_paths)} images on disk")
    work_analyzed = {p: d["result"] for p, d in all_image_paths.items()}
    paths = list(work_analyzed.keys())
    n = len(paths)

    if n < 4:
        log("Too few images.")
        return

    # Embed
    embeddings = build_embeddings(work_analyzed, paths)

    # K selection
    max_k = min(MAX_K, n // MIN_CLUSTER_SIZE)
    best_k, best_score, best_asgn, best_centroids = 2, -1.0, None, None

    log("Selecting K via silhouette...")
    for k in range(2, max_k + 1):
        asgn, cents = kmeans(embeddings, k)
        if len(set(asgn.tolist())) < k:
            continue
        score = silhouette(embeddings, asgn, k)
        log(f"  k={k}  silhouette={score:.4f}")
        if score > best_score:
            best_score, best_k, best_asgn, best_centroids = score, k, asgn, cents

    log(f"Best k={best_k}  silhouette={best_score:.4f}")

    # Outliers → misc
    outlier_idxs = detect_outliers(embeddings, best_asgn, best_centroids)
    log(f"Outliers: {len(outlier_idxs)}")

    # Group
    groups = {}
    misc_paths = []
    for i, c in enumerate(best_asgn.tolist()):
        if i in outlier_idxs:
            misc_paths.append(paths[i])
        else:
            groups.setdefault(c, []).append(paths[i])

    # Dissolve small clusters
    final_groups = {}
    for c, members in groups.items():
        if len(members) < MIN_CLUSTER_SIZE:
            log(f"  Dissolving cluster {c} ({len(members)}) → misc")
            misc_paths.extend(members)
        else:
            final_groups[c] = members

    log(f"Named clusters: {len(final_groups)}  |  Misc: {len(misc_paths)}")

    # LLM labels
    log("\nGenerating labels via LLM...")
    labels = {}
    for c, members in final_groups.items():
        label = llm_label(members, work_analyzed, c)
        log(f"  Cluster {c} ({len(members)} files): {label}")
        labels[c] = label

    # Resolve collisions
    seen = {}
    for c in list(final_groups.keys()):
        label = labels[c]
        if label in seen:
            seen[label] += 1
            labels[c] = f"{label}-{seen[label]}"
        else:
            seen[label] = 1

    # Build moves
    moves = []
    for c, members in final_groups.items():
        folder = labels[c]
        for orig in members:
            current = all_image_paths[orig]["current"]
            dest_dir = FOLDER / folder
            dest = dest_dir / Path(orig).name
            n_s = 1
            while dest.exists() and str(dest) != current:
                dest = dest_dir / f"{Path(orig).stem}-{n_s}{Path(orig).suffix}"
                n_s += 1
            moves.append((current, str(dest), folder))

    for orig in misc_paths:
        current = all_image_paths[orig]["current"]
        dest = FOLDER / "misc" / Path(orig).name
        moves.append((current, str(dest), "misc"))

    # Apply
    log(f"\n--- MOVING {len(moves)} files ---")
    ts = datetime.now().isoformat()
    moved, errors = 0, []
    with open(LOG_FILE, "a") as logf:
        logf.write(f"\n--- {ts} [RECLUSTER-V3] ---\n")
        for src, dst, folder in moves:
            if src == dst:
                continue
            Path(dst).parent.mkdir(exist_ok=True)
            try:
                shutil.move(src, dst)
                logf.write(f"MOVE: {src} → {dst}\n")
                moved += 1
            except Exception as e:
                err = f"ERROR: {src} — {e}"
                logf.write(err + "\n")
                errors.append(err)
                log(err)
        logf.write(f"--- {moved} moved, {len(errors)} errors ---\n")

    # Clean empty dirs
    for item in sorted(FOLDER.iterdir()):
        if item.is_dir() and not item.name.startswith("."):
            try:
                item.rmdir()
            except OSError:
                pass

    # Update state
    state["clusters"] = [
        {"label": labels[c], "imagePaths": final_groups[c]} for c in final_groups
    ]
    state["misc"] = misc_paths
    STATE_FILE.write_text(json.dumps(state, indent=2))

    log(f"\nDone. {moved} moved, {len(errors)} errors.")
    log(f"Clusters: {len(final_groups)}  |  Misc: {len(misc_paths)}")
    for c in final_groups:
        log(f"  {labels[c]}: {len(final_groups[c])} files")
    log(f"  misc: {len(misc_paths)} files")


if __name__ == "__main__":
    main()
