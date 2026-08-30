import { vi, afterAll, describe, it, expect } from "vitest";
import { rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const testDir = vi.hoisted(() => {
  const { mkdtempSync } = require("fs");
  const { join: j } = require("path");
  const { tmpdir } = require("os");
  return mkdtempSync(j(tmpdir(), "context-mcp-init-"));
});

vi.mock("../config.js", () => ({
  config: {
    contextDir: testDir,
    maxFileSize: 1_048_576,
    versionCacheSize: 5,
    get trashDir() {
      const { join: j } = require("path");
      return j(testDir, ".trash");
    },
    mode: "stdio" as const,
    port: 3100,
  },
}));

import { initContextDir, isContextDirInitialized, getSeedFiles } from "./context-dir.js";

afterAll(() => {
  try {
    rmSync(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

describe("getSeedFiles", () => {
  it("returns the expected list of seed files", () => {
    const seeds = getSeedFiles();
    expect(seeds.length).toBeGreaterThan(0);
    const filenames = seeds.map((s) => s.filename);
    expect(filenames).toContain("CONTEXT_GUIDE.md");
    expect(filenames).toContain("who-i-am.md");
    expect(filenames).toContain("goals.md");
    expect(filenames).toContain("preferences-and-habits.md");
    expect(filenames).toContain("journal.md");
    expect(filenames).toContain("feedback.md");
  });

  it("each seed file has non-empty content", () => {
    const seeds = getSeedFiles();
    for (const seed of seeds) {
      expect(seed.content.length).toBeGreaterThan(0);
    }
  });
});

describe("initContextDir", () => {
  it("creates the context directory and seed files", async () => {
    const result = await initContextDir();
    expect(result.directory).toBe(testDir);
    expect(result.created.length).toBeGreaterThan(0);
    expect(result.skipped).toEqual([]);
  });

  it("skips files that already exist", async () => {
    const result = await initContextDir();
    expect(result.skipped.length).toBeGreaterThan(0);
    expect(result.created).toEqual([]);
  });

  it("creates CONTEXT_GUIDE.md with content", async () => {
    const guidePath = join(testDir, "CONTEXT_GUIDE.md");
    expect(existsSync(guidePath)).toBe(true);
    const content = readFileSync(guidePath, "utf-8");
    expect(content).toContain("CONTEXT GUIDE");
  });
});

describe("isContextDirInitialized", () => {
  it("returns true when CONTEXT_GUIDE.md exists", () => {
    expect(isContextDirInitialized()).toBe(true);
  });
});
