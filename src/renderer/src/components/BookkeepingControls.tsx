import { useRef, useState } from "react";
import { Upload, Loader2, CheckCircle2, XCircle, RotateCcw, FolderOpen } from "lucide-react";
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
      setErrorMsg("No image or PDF files found. Drop bank statement screenshots.");
      setPhase("error");
      return;
    }

    setPhase("processing");
    setStatus("Opening folder picker…");
    setFolders([]);
    setErrorMsg("");

    // Open folder picker with the default dir pre-selected
    const outputDir = await window.api.pickFolder(
      "Choose where to create voucher folders",
      defaultOutputDir,
    );

    if (!outputDir) {
      // User cancelled
      setPhase("idle");
      return;
    }

    setStatus(`Sending ${imageFiles.length} file${imageFiles.length > 1 ? "s" : ""} to Claude…`);

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

    const result = await window.api.createVoucherFolders(droppedFiles, outputDir);

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
        className="flex flex-col items-center justify-center gap-2 py-4"
        onClick={(e) => e.stopPropagation()}
      >
        <Loader2 size={18} className="animate-spin text-zinc-400" />
        <p className="text-xs text-zinc-500 text-center">{status}</p>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2">
          <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-400 font-medium">
            {folders.length} folder{folders.length !== 1 ? "s" : ""} created
          </p>
        </div>
        {folders.length > 0 && (
          <ul className="text-[11px] text-zinc-500 space-y-0.5 max-h-28 overflow-y-auto">
            {folders.map((f) => (
              <li key={f} className="truncate leading-snug">
                📁 {f}
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-1.5 pt-1">
          <button
            onClick={handleReveal}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium
                       border border-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600
                       hover:bg-zinc-800/60 transition-all duration-150
                       focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900"
          >
            <FolderOpen size={13} />
            Show in Finder
          </button>
          <button
            onClick={reset}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-zinc-700/60
                       text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800/60
                       transition-all duration-150
                       focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900"
            title="Process another statement"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2">
          <XCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-400 leading-snug">{errorMsg}</p>
        </div>
        <button
          onClick={reset}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-medium
                     border border-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600
                     hover:bg-zinc-800/60 transition-all duration-150
                     focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900"
        >
          <RotateCcw size={12} />
          Try again
        </button>
      </div>
    );
  }

  // idle — drop zone
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <label
        ref={dropRef as unknown as React.RefObject<HTMLLabelElement>}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={[
          "flex flex-col items-center justify-center gap-2 rounded-xl py-4 cursor-pointer",
          "border-2 border-dashed transition-all duration-150",
          dragOver
            ? "border-zinc-500 bg-zinc-800/60 text-zinc-300"
            : "border-zinc-700/60 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/30",
        ].join(" ")}
      >
        <Upload size={16} className="shrink-0" />
        <span className="text-xs text-center leading-snug px-2">
          Drop bank statement
          <br />
          screenshots here
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
