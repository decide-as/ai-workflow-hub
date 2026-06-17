import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
  spawnSync: vi.fn(),
}));

vi.mock("fs", () => ({
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  chmodSync: vi.fn(),
}));

import { execSync, spawnSync } from "child_process";
import { existsSync } from "fs";
import {
  openInTerminal,
  isIterm2Running,
  findClaudeBin,
} from "../src/main/terminal";

const mockExecSync = vi.mocked(execSync);
const mockSpawnSync = vi.mocked(spawnSync);
const mockExistsSync = vi.mocked(existsSync);

function makeSpawnResult(status: number, stderr = "") {
  return {
    status,
    stdout: "",
    stderr,
    pid: 1,
    output: [],
    signal: null,
  } as ReturnType<typeof spawnSync>;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Defaults: path exists, claude found (string return for utf-8 call), iTerm2 not running, osascript succeeds
  mockExistsSync.mockReturnValue(true);
  mockExecSync.mockImplementation((cmd: string) => {
    if (cmd === "which claude")
      return "/usr/local/bin/claude\n" as unknown as Buffer;
    // pgrep -x iTerm2 throws when not running
    throw new Error("no match");
  });
  mockSpawnSync.mockReturnValue(makeSpawnResult(0));
});

describe("isIterm2Running()", () => {
  it("returns true when iTerm2 process is found", () => {
    // pgrep returns a Buffer with pid
    mockExecSync.mockReturnValue(Buffer.from("1234\n"));
    expect(isIterm2Running()).toBe(true);
  });

  it("returns false when pgrep throws (iTerm2 not running)", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("exit 1");
    });
    expect(isIterm2Running()).toBe(false);
  });
});

describe("findClaudeBin()", () => {
  it("returns path when claude is on PATH", () => {
    // execSync with encoding:'utf-8' returns a string
    mockExecSync.mockReturnValue(
      "/usr/local/bin/claude\n" as unknown as Buffer,
    );
    expect(findClaudeBin()).toBe("/usr/local/bin/claude");
  });

  it("returns null when which claude throws", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not found");
    });
    expect(findClaudeBin()).toBeNull();
  });

  it("returns null when which claude returns empty string", () => {
    mockExecSync.mockReturnValue("" as unknown as Buffer);
    expect(findClaudeBin()).toBeNull();
  });
});

describe("openInTerminal()", () => {
  it("returns path-missing error when repo path does not exist", () => {
    mockExistsSync.mockReturnValue(false);
    const result = openInTerminal("/nonexistent/path");
    expect(result.success).toBe(false);
    expect(result.errorKind).toBe("path-missing");
  });

  it("returns claude-missing error when claude not on PATH", () => {
    mockExistsSync.mockReturnValue(true);
    mockExecSync.mockImplementation(() => {
      throw new Error("not found");
    });
    const result = openInTerminal("/some/repo");
    expect(result.success).toBe(false);
    expect(result.errorKind).toBe("claude-missing");
    expect(result.error).toContain("claude.ai");
  });

  it("returns success when osascript exits 0", () => {
    mockExistsSync.mockReturnValue(true);
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd === "which claude")
        return "/usr/bin/claude\n" as unknown as Buffer;
      throw new Error();
    });
    mockSpawnSync.mockReturnValue(makeSpawnResult(0));
    const result = openInTerminal("/valid/repo");
    expect(result.success).toBe(true);
    expect(result.errorKind).toBeUndefined();
  });

  it('returns permission error when osascript stderr contains "not authorized"', () => {
    mockExistsSync.mockReturnValue(true);
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd === "which claude")
        return "/usr/bin/claude\n" as unknown as Buffer;
      throw new Error();
    });
    mockSpawnSync.mockReturnValue(
      makeSpawnResult(
        1,
        "osascript is not allowed assistive access. not authorized (-1719)",
      ),
    );
    const result = openInTerminal("/valid/repo");
    expect(result.success).toBe(false);
    expect(result.errorKind).toBe("permission");
    expect(result.error).toContain("System Settings");
  });

  it("returns unknown error for generic osascript failure", () => {
    mockExistsSync.mockReturnValue(true);
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd === "which claude")
        return "/usr/bin/claude\n" as unknown as Buffer;
      throw new Error();
    });
    mockSpawnSync.mockReturnValue(makeSpawnResult(1, "some unexpected error"));
    const result = openInTerminal("/valid/repo");
    expect(result.success).toBe(false);
    expect(result.errorKind).toBe("unknown");
  });

  it("succeeds when initialPrompt is provided", () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult(0));
    const result = openInTerminal("/valid/repo", "Please summarise the receipts");
    expect(result.success).toBe(true);
  });
});
