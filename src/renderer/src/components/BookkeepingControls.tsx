import { useRef, useState } from "react";
import {
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  FolderOpen,
} from "lucide-react";
import type { Workflow } from "../../../../shared/types";

interface Props {
  workflow: Workflow;
}

type Phase = "idle" | "processing" | "done" | "error";

interface DroppedFile {
  name: string;
  dataUrl: string;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function BookkeepingControls({ workflow }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState("");
  const [folders, setFolders] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const dropRef = useRef<HTMLDivElement>(null);

  const defaultOutputDir =
    workflow.bookkeeping?.default_output_dir ?? "~/Documents";

  async function processFiles(files: FileList | File[]) {
    const imageFiles = Array.from(files).filter(
      (f) =>
        f.type.startsWith("image/") ||
        f.type === "application/pdf" ||
        f.name.toLowerCase().endsWith(".pdf"),
    );

    if (imageFiles.length === 0) {
      setErrorMsg("No image or PDF files found.");
      setPhase("error");
      return;
    }

    setPhase("processing");
    setStatus("Opening folder picker…");
    setFolders([]);
    setErrorMsg("");

    const outputDir = await window.api.pickFolder(
      "Choose where to create voucher folders",
      defaultOutputDir,
    );

    if (!outputDir) {
      setPhase("idle");
      return;
    }

    setStatus(
      `Sending ${imageFiles.length} file${imageFiles.length > 1 ? "s" : ""} to Claude…`,
    );

    let droppedFiles: DroppedFile[];
    try {
      droppedFiles = await Promise.all(
        imageFiles.map(async (f) => ({
          name: f.name,
          dataUrl: await readFileAsDataUrl(f),
        })),
      );
    } catch {
      setErrorMsg("Could not read the dropped files.");
      setPhase("error");
      return;
    }

    setStatus("Claude is reading the bank statement…");

    const result = await window.api.createVoucherFolders(
      droppedFiles,
      outputDir,
    );

    if (!result.success) {
      setErrorMsg(result.error ?? "Unknown error");
      setPhase("error");
      return;
    }

    setFolders(result.folders);
    setPhase("done");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (phase === "processing") return;
    processFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) processFiles(e.target.files);
  }

  function reset(e: React.MouseEvent) {
    e.stopPropagation();
    setPhase("idle");
    setFolders([]);
    setErrorMsg("");
    setStatus("");
  }

  function handleReveal(e: React.MouseEvent) {
    e.stopPropagation();
    const dir = workflow.bookkeeping?.default_output_dir ?? "";
    if (dir) window.api.revealPath(dir);
  }

  if (phase === "processing") {
    return (
      <div
        className="flex items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <Loader2
          size={11}
          className="animate-spin shrink-0"
          style={{ color: "var(--c-text-muted)" }}
        />
        <span
          className="text-[11px] truncate"
          style={{ color: "var(--c-text-muted)" }}
        >
          {status}
        </span>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div
        className="flex items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <CheckCircle2 size={11} className="shrink-0 text-emerald-400" />
        <span className="text-[11px] text-emerald-400 flex-1 truncate">
          {folders.length} folder{folders.length !== 1 ? "s" : ""} created
        </span>
        <button onClick={handleReveal} className="btn btn-sm shrink-0">
          <FolderOpen size={11} />
          Reveal
        </button>
        <button
          onClick={reset}
          className="btn btn-sm w-7 h-7 p-0 shrink-0"
          title="Process another"
        >
          <RotateCcw size={11} />
        </button>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div
        className="flex items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <XCircle size={11} className="shrink-0 text-red-400" />
        <span className="text-[11px] text-red-400 flex-1 truncate">
          {errorMsg}
        </span>
        <button onClick={reset} className="btn btn-sm shrink-0">
          <RotateCcw size={11} />
          Retry
        </button>
      </div>
    );
  }

  // idle — compact single-row drop strip
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <label
        ref={dropRef as unknown as React.RefObject<HTMLLabelElement>}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={[
          "flex items-center gap-2 rounded-lg px-3 cursor-pointer w-full",
          "border border-dashed transition-all duration-150",
          dragOver
            ? "border-zinc-500 bg-zinc-800/60 text-zinc-300"
            : "border-zinc-700/60 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/30",
        ].join(" ")}
        style={{ height: "28px" }}
      >
        <Upload size={11} className="shrink-0" />
        <span className="text-[11px] truncate">
          Drop bank statement screenshots here
        </span>
        <input
          type="file"
          accept="image/*,.pdf"
          multiple
          className="sr-only"
          onChange={handleFileInput}
          onClick={(e) => e.stopPropagation()}
        />
      </label>
    </div>
  );
}
