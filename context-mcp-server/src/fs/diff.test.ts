import { vi, beforeAll, afterAll, describe, it, expect } from "vitest";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";

const testDir = vi.hoisted(() => {
  const { mkdtempSync } = require("fs");
  const { join: j } = require("path");
  const { tmpdir } = require("os");
  return mkdtempSync(j(tmpdir(), "context-mcp-diff-"));
});

vi.mock("../config.js", () => ({
  config: {
    contextDir: testDir,
    maxFileSize: 1_048_576,
    versionCacheSize: 10,
    get trashDir() {
      const { join: j } = require("path");
      return j(testDir, ".trash");
    },
    mode: "stdio" as const,
    port: 3100,
  },
}));

import { recordVersion, computeDiff, ensureCurrentVersionCached } from "./diff.js";
import { writeFile } from "./file-ops.js";

const fullFm = (id: string, ver: number) =>
  `---\nid: ${id}\ntitle: "${id}"\ncreated: "2025-01-01T00:00:00.000Z"\nupdated: "2025-01-01T00:00:00.000Z"\nversion: ${ver}\n---\n`;

beforeAll(() => {
  mkdirSync(testDir, { recursive: true });
});

afterAll(() => {
  try {
    rmSync(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

describe("recordVersion", () => {
  it("stores a version record", () => {
    const content = "---\nid: test\nversion: 1\n---\nbody";
    recordVersion("test-cache.md", content, 1);
  });

  it("handles multiple versions", () => {
    recordVersion("multi-version.md", "v1 content", 1);
    recordVersion("multi-version.md", "v2 content", 2);
    recordVersion("multi-version.md", "v3 content", 3);
  });
});

describe("computeDiff", () => {
  it("returns file-not-found for non-existent file", async () => {
    const result = await computeDiff("no-such-file.md");
    expect(result.summary).toBe("File not found");
    expect(result.diff).toEqual([]);
  });

  it("computes diff between versions", async () => {
    await writeFile("diff-test.md", fullFm("diff-test", 1) + "Line A\nLine B\nLine C", true);

    const { editFile } = await import("./file-ops.js");
    await editFile({
      filename: "diff-test.md",
      version: 1,
      operation: "append",
      new_content: "Line D",
    });

    const result = await computeDiff("diff-test.md", 1, 2);
    expect(result.filename).toBe("diff-test.md");
    expect(result.version_a).toBe(1);
    expect(result.version_b).toBe(2);
    expect(result.diff.length).toBeGreaterThan(0);

    const addedLines = result.diff.filter((d) => d.type === "added");
    expect(addedLines.length).toBeGreaterThan(0);
  });
});

describe("ensureCurrentVersionCached", () => {
  it("does not throw for non-existent file", async () => {
    await expect(ensureCurrentVersionCached("ghost.md")).resolves.toBeUndefined();
  });

  it("caches the current version from disk", async () => {
    await writeFile("cache-me.md", fullFm("cache-me", 1) + "cache this", true);
    await expect(ensureCurrentVersionCached("cache-me.md")).resolves.toBeUndefined();

    const result = await computeDiff("cache-me.md", 1, 1);
    expect(result.summary).not.toContain("not available");
  });
});
