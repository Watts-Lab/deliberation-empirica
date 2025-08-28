import { describe, test, expect, vi } from "vitest";
import * as vscode from "vscode";
import { dlConfigSchema } from "./validateDlConfig"; // adjust the path as needed

// Mock the VS Code API
vi.mock("vscode", () => ({
    workspace: {
      workspaceFolders: [
        { uri: { fsPath: "/mock-workspace" } }
      ],
      fs: {
        stat: vi.fn(),
      },
    },
    Uri: {
      joinPath: (...segments) => {
        const paths = segments.map(s => (typeof s === "string" ? s : s.fsPath));
        return { fsPath: paths.join("/") };
      },
      file: (path) => ({ fsPath: path }),
    },
    FileType: {
      Directory: 2,
      File: 1,
    },
    FileSystemError: class FileSystemError extends Error {}
  }));

const mockedStat = vscode.workspace.fs.stat;

describe("dlConfigSchema", () => {
  test("passes when experimentRoot is a valid directory", async () => {
    mockedStat.mockResolvedValueOnce({ type: vscode.FileType.Directory });

    const config = {
      experimentRoot: "valid-folder"
    };

    const result = await dlConfigSchema.safeParseAsync(config);
    expect(result.success).toBe(true);
  });

  test("fails when experimentRoot is a file", async () => {
    mockedStat.mockResolvedValueOnce({ type: vscode.FileType.File });

    const config = {
      experimentRoot: "not-a-folder"
    };

    const result = await dlConfigSchema.safeParseAsync(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["experimentRoot"]);
      expect(result.error.issues[0].message).toMatch(/must be a directory/);
    }
  });

  test("fails when experimentRoot does not exist", async () => {
    mockedStat.mockRejectedValueOnce(new vscode.FileSystemError("FileNotFound"));

    const config = {
      experimentRoot: "nonexistent-folder"
    };

    const result = await dlConfigSchema.safeParseAsync(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["experimentRoot"]);
      expect(result.error.issues[0].message).toMatch(/does not exist/);
    }
  });
});
