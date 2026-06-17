import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
  spawnSync: vi.fn(),
}));

vi.mock("fs", () => ({
  existsSync: vi.fn(),
}));

vi.mock("electron", () => ({
  dialog: { showOpenDialog: vi.fn() },
}));

import { execSync, spawnSync } from "child_process";
import { existsSync } from "fs";
import { dialog } from "electron";
import { findInterpreter, runScript, pickFolder } from "../src/main/runner";
import type { WorkflowRunner } from "../shared/types";

const mockExecSync = vi.mocked(execSync);
const mockSpawnSync = vi.mocked(spawnSync);
const mockExistsSync = vi.mocked(existsSync);
const mockShowOpenDialog = vi.mocked(dialog.showOpenDialog);

const RUNNER: WorkflowRunner = {
  script: "scripts/organize.py",
  interpreter: "python3",
  preview: true,
  apply_flag: "--execute",
};

function spawnResult(status: number, stdout = "", stderr = "") {
  return {
    status,
    stdout,
    stderr,
    pid: 1,
    output: [],
    signal: null,
  } as ReturnType<typeof spawnSync>;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Defaults: interpreter found, all paths exist, script succeeds.
  mockExistsSync.mockReturnValue(true);
  mockExecSync.mockReturnValue("/usr/bin/python3\n" as unknown as Buffer);
  mockSpawnSync.mockReturnValue(spawnResult(0, "OK"));
});

describe("findInterpreter()", () => {
  it("returns the resolved path when the interpreter is on PATH", () => {
    mockExecSync.mockReturnValue(
      "/opt/homebrew/bin/python3\n" as unknown as Buffer,
    );
    expect(findInterpreter("python3")).toBe("/opt/homebrew/bin/python3");
  });

  it("falls back to python when python3 is absent", () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd === "which python")
        return "/usr/bin/python\n" as unknown as Buffer;
      throw new Error("not found");
    });
    expect(findInterpreter()).toBe("/usr/bin/python");
  });

  it("returns null when no interpreter is found", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not found");
    });
    expect(findInterpreter()).toBeNull();
  });

  it("probes an absolute interpreter path directly without which", () => {
    mockExistsSync.mockReturnValue(true);
    expect(findInterpreter("/custom/python3")).toBe("/custom/python3");
    expect(mockExecSync).not.toHaveBeenCalled();
  });
});

describe("runScript()", () => {
  it("returns interpreter-missing when no interpreter is found", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not found");
    });
    const r = runScript("/repo", RUNNER, "/folder", false);
    expect(r.success).toBe(false);
    expect(r.errorKind).toBe("interpreter-missing");
  });

  it("returns script-missing when the script file is absent", () => {
    mockExistsSync.mockImplementation((p) => p !== "/repo/scripts/organize.py");
    const r = runScript("/repo", RUNNER, "/folder", false);
    expect(r.success).toBe(false);
    expect(r.errorKind).toBe("script-missing");
  });

  it("returns folder-missing when the target folder is absent", () => {
    mockExistsSync.mockImplementation((p) => p !== "/folder");
    const r = runScript("/repo", RUNNER, "/folder", false);
    expect(r.success).toBe(false);
    expect(r.errorKind).toBe("folder-missing");
  });

  it("runs a dry-run preview without the apply flag", () => {
    runScript("/repo", RUNNER, "/folder", false);
    const args = mockSpawnSync.mock.calls[0][1] as string[];
    expect(args).toEqual(["/repo/scripts/organize.py", "/folder"]);
    expect(args).not.toContain("--execute");
  });

  it("appends the apply flag for a real run", () => {
    runScript("/repo", RUNNER, "/folder", true);
    const args = mockSpawnSync.mock.calls[0][1] as string[];
    expect(args).toContain("--execute");
  });

  it("inserts extra option args after the folder and before the apply flag", () => {
    runScript("/repo", RUNNER, "/folder", true, ["--min-age-days", "7"]);
    const args = mockSpawnSync.mock.calls[0][1] as string[];
    expect(args).toEqual([
      "/repo/scripts/organize.py",
      "/folder",
      "--min-age-days",
      "7",
      "--execute",
    ]);
  });

  it("returns success with captured output on exit 0", () => {
    mockSpawnSync.mockReturnValue(spawnResult(0, "plan output"));
    const r = runScript("/repo", RUNNER, "/folder", false);
    expect(r.success).toBe(true);
    expect(r.output).toBe("plan output");
  });

  it("returns failure with stderr surfaced on a non-zero exit", () => {
    mockSpawnSync.mockReturnValue(spawnResult(2, "partial", "boom"));
    const r = runScript("/repo", RUNNER, "/folder", true);
    expect(r.success).toBe(false);
    expect(r.output).toContain("partial");
    expect(r.output).toContain("boom");
    expect(r.error).toBe("boom");
  });
});

describe("pickFolder()", () => {
  it("returns the chosen folder path", async () => {
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ["/chosen/dir"],
    });
    await expect(pickFolder(null, "Pick one")).resolves.toBe("/chosen/dir");
  });

  it("returns null when the dialog is cancelled", async () => {
    mockShowOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    await expect(pickFolder(null)).resolves.toBeNull();
  });
});
