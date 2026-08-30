import { diffLines } from "diff";
import { readFile as fsReadFile } from "fs/promises";
import { existsSync } from "fs";
import { config } from "../config.js";
import { resolvePath, readFile } from "./file-ops.js";

export interface DiffLine {
  type: "unchanged" | "removed" | "added";
  content: string;
  line_a: number | null;
  line_b: number | null;
}

export interface DiffResult {
  filename: string;
  version_a: number;
  version_b: number;
  diff: DiffLine[];
  summary: string;
}

interface VersionRecord {
  version: number;
  content: string;
  timestamp: string;
}

/**
 * In-memory version cache: filename -> VersionRecord[]
 * Stores the last N versions per file (configurable via versionCacheSize).
 */
const versionCache = new Map<string, VersionRecord[]>();

/**
 * Record a version snapshot for a file.
 * Called automatically when a file is written/edited.
 */
export function recordVersion(filename: string, content: string, version: number): void {
  const cacheSize = config.versionCacheSize;

  if (!versionCache.has(filename)) {
    versionCache.set(filename, []);
  }

  const records = versionCache.get(filename)!;

  // Remove existing record with same version if any
  const existingIdx = records.findIndex((r) => r.version === version);
  if (existingIdx !== -1) {
    records.splice(existingIdx, 1);
  }

  records.push({
    version,
    content,
    timestamp: new Date().toISOString(),
  });

  // Sort by version ascending
  records.sort((a, b) => a.version - b.version);

  // Trim to cache size, keeping the newest versions
  while (records.length > cacheSize) {
    records.shift();
  }
}

/**
 * Get the current file content from disk and parse its version.
 */
async function getCurrentVersion(filename: string): Promise<{ content: string; version: number } | null> {
  try {
    const filePath = resolvePath(filename);
    if (!existsSync(filePath)) return null;

    const result = await readFile(filename);
    return {
      content: result.content,
      version: result.version,
    };
  } catch {
    return null;
  }
}

/**
 * Get a specific version's content from the cache.
 * Falls back to current file on disk for the latest version.
 */
async function getVersionContent(filename: string, version: number): Promise<string | null> {
  // Check in-memory cache first
  const records = versionCache.get(filename);
  if (records) {
    const record = records.find((r) => r.version === version);
    if (record) return record.content;
  }

  // For the current version, read from disk
  const current = await getCurrentVersion(filename);
  if (current && current.version === version) {
    // Cache it for future use
    recordVersion(filename, current.content, current.version);
    return current.content;
  }

  return null;
}

/**
 * Ensure the current version is cached.
 */
export async function ensureCurrentVersionCached(filename: string): Promise<void> {
  const current = await getCurrentVersion(filename);
  if (current) {
    const records = versionCache.get(filename);
    const alreadyCached = records?.some((r) => r.version === current.version);
    if (!alreadyCached) {
      recordVersion(filename, current.content, current.version);
    }
  }
}

/**
 * Compute a diff between two versions of a file.
 * If versionA is not provided, defaults to current - 1.
 * If versionB is not provided, defaults to current.
 */
export async function computeDiff(
  filename: string,
  versionA?: number,
  versionB?: number
): Promise<DiffResult> {
  // Ensure current version is cached
  await ensureCurrentVersionCached(filename);

  const current = await getCurrentVersion(filename);
  if (!current) {
    return {
      filename,
      version_a: versionA ?? 0,
      version_b: versionB ?? 0,
      diff: [],
      summary: "File not found",
    };
  }

  const vA = versionA ?? Math.max(1, current.version - 1);
  const vB = versionB ?? current.version;

  const contentA = await getVersionContent(filename, vA);
  const contentB = await getVersionContent(filename, vB);

  if (!contentA || !contentB) {
    // One or both versions not available
    const missing: string[] = [];
    if (!contentA) missing.push(`v${vA}`);
    if (!contentB) missing.push(`v${vB}`);
    return {
      filename,
      version_a: vA,
      version_b: vB,
      diff: [],
      summary: `Version(s) not available: ${missing.join(", ")}`,
    };
  }

  // Parse out frontmatter for cleaner diff (compare bodies only)
  const { parseFrontmatter } = await import("./frontmatter.js");
  const parsedA = parseFrontmatter(contentA);
  const parsedB = parseFrontmatter(contentB);

  const changes = diffLines(parsedA.body, parsedB.body);

  const diff: DiffLine[] = [];
  let lineA = 1;
  let lineB = 1;
  let added = 0;
  let removed = 0;
  let unchanged = 0;

  for (const change of changes) {
    const lines = change.value.replace(/\n$/, "").split("\n");

    for (const line of lines) {
      if (change.removed) {
        diff.push({ type: "removed", content: line, line_a: lineA, line_b: null });
        lineA++;
        removed++;
      } else if (change.added) {
        diff.push({ type: "added", content: line, line_a: null, line_b: lineB });
        lineB++;
        added++;
      } else {
        diff.push({ type: "unchanged", content: line, line_a: lineA, line_b: lineB });
        lineA++;
        lineB++;
        unchanged++;
      }
    }
  }

  const parts: string[] = [];
  parts.push(`${unchanged} line(s) unchanged`);
  if (added > 0) parts.push(`${added} added`);
  if (removed > 0) parts.push(`${removed} removed`);
  const summary = parts.join(", ");

  return {
    filename,
    version_a: vA,
    version_b: vB,
    diff,
    summary,
  };
}
