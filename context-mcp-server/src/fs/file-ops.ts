import { readFile as fsReadFile, writeFile as fsWriteFile, rename as fsRename, unlink as fsUnlink, mkdir, stat, readdir } from "fs/promises";
import { existsSync } from "fs";
import { join, resolve, normalize, relative, sep } from "path";
import { config } from "../config.js";
import {
  parseFrontmatter,
  validateFrontmatter,
  generateFrontmatter,
  bumpVersion,
  serializeContent,
  normalizeLineEndings,
  Frontmatter,
} from "./frontmatter.js";
import { checkVersion, VersionMismatchError } from "./locking.js";
import { recordVersion } from "./diff.js";

export interface ReadResult {
  content: string;
  frontmatter: Frontmatter;
  body: string;
  version: number;
  path: string;
  exists: boolean;
}

export interface WriteResult {
  success: boolean;
  version: number;
  path: string;
}

export interface EditResult {
  success: boolean;
  version: number;
  section_found?: boolean;
  lines_replaced?: number;
}

export interface ListResult {
  files: FileInfo[];
  total: number;
  directory: string;
}

export interface FileInfo {
  filename: string;
  path: string;
  frontmatter: Frontmatter;
  size: number;
  last_modified: string;
  body_preview?: string;
}

export type EditOperation = "replace_section" | "replace_lines" | "append" | "prepend";

export interface EditOptions {
  filename: string;
  version: number;
  operation: EditOperation;
  section?: string;
  start_line?: number;
  end_line?: number;
  new_content: string;
}

/**
 * Validate that a filename is safe (no path traversal).
 */
export function validateFilename(filename: string): string {
  if (!filename || filename.trim().length === 0) {
    throw new Error("PATH_TRAVERSAL: Filename cannot be empty");
  }

  // Normalize separators to forward slash, then reject path traversal
  const normalized = filename.replace(/\\/g, "/");

  // Reject absolute paths
  if (normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized)) {
    throw new Error("PATH_TRAVERSAL: Absolute paths are not allowed");
  }

  // Reject parent directory references
  const parts = normalized.split("/");
  for (const part of parts) {
    if (part === "..") {
      throw new Error("PATH_TRAVERSAL: Path traversal (..) is not allowed");
    }
    if (part === ".") {
      throw new Error("PATH_TRAVERSAL: Path traversal (.) is not allowed");
    }
  }

  // Reject null bytes
  if (filename.includes("\0")) {
    throw new Error("PATH_TRAVERSAL: Null bytes are not allowed in filename");
  }

  return normalized;
}

/**
 * Resolve a filename to its absolute path within the context directory.
 */
export function resolvePath(filename: string): string {
  const safeFilename = validateFilename(filename);
  // Resolve relative to context directory
  const fullPath = resolve(join(config.contextDir, safeFilename));
  // Verify the resolved path is still within the context directory
  const relativePath = relative(config.contextDir, fullPath);
  if (relativePath.startsWith("..") || normalize(relativePath) !== relativePath) {
    throw new Error("PATH_TRAVERSAL: Resolved path escapes the context directory");
  }
  return fullPath;
}

/**
 * Read a file by filename.
 */
export async function readFile(filename: string): Promise<ReadResult> {
  const filePath = resolvePath(filename);

  if (!existsSync(filePath)) {
    return {
      content: "",
      frontmatter: {} as Frontmatter,
      body: "",
      version: 0,
      path: filePath,
      exists: false,
    };
  }

  const rawContent = await fsReadFile(filePath, "utf-8");
  const stats = await stat(filePath);

  if (stats.size > config.maxFileSize) {
    throw new Error(`FILE_TOO_LARGE: File exceeds maximum size of ${config.maxFileSize} bytes`);
  }

  const parsed = parseFrontmatter(rawContent);

  return {
    content: parsed.content,
    frontmatter: parsed.frontmatter,
    body: parsed.body,
    version: parsed.frontmatter.version || 0,
    path: filePath,
    exists: true,
  };
}

/**
 * Write a new file or overwrite an existing one.
 * Uses atomic write pattern: write to .tmp then rename.
 */
export async function writeFile(
  filename: string,
  content: string,
  overwrite?: boolean,
  expectedVersion?: number
): Promise<WriteResult> {
  const filePath = resolvePath(filename);

  // Check if file exists
  const fileExists = existsSync(filePath);
  if (fileExists && !overwrite) {
    throw new Error(
      `FILE_EXISTS: File '${filename}' already exists. Use overwrite=true or context_edit to modify.`
    );
  }

  // Normalize line endings
  const normalizedContent = normalizeLineEndings(content);

  // Parse the incoming content
  const parsed = parseFrontmatter(normalizedContent);

  let finalFm: Frontmatter;
  let finalBody: string;

  if (fileExists && overwrite) {
    // Read current file for version check
    const currentRaw = await fsReadFile(filePath, "utf-8");
    const current = parseFrontmatter(currentRaw);

    // Record old version in diff cache before overwriting
    recordVersion(filename, currentRaw, current.frontmatter.version || 0);

    if (expectedVersion !== undefined && expectedVersion !== null) {
      checkVersion(current.frontmatter.version || 0, expectedVersion);
    }

    if (parsed.hasFrontmatter) {
      // Use provided frontmatter but keep version from current + bump
      const { version: _providedVersion, ...restFm } = parsed.frontmatter;
      finalFm = bumpVersion({ ...current.frontmatter, ...restFm });
      finalBody = parsed.body;
    } else {
      // Keep existing frontmatter, update timestamp/version, use new body
      finalFm = bumpVersion(current.frontmatter);
      finalBody = parsed.body || normalizedContent;
    }
  } else {
    // New file
    if (parsed.hasFrontmatter) {
      validateFrontmatter(parsed.frontmatter);
      // If version is already set in content, ensure it starts at 1
      finalFm = { ...parsed.frontmatter, version: 1, updated: new Date().toISOString() };
      finalBody = parsed.body;
    } else {
      // Generate default frontmatter
      finalFm = generateFrontmatter(
        filename.replace(/\.md$/i, "").replace(/[^a-zA-Z0-9-_]/g, "-"),
        filename.replace(/\.md$/i, "")
      );
      finalBody = normalizedContent;
    }
  }

  const finalContent = serializeContent(finalFm, finalBody);

  // Ensure directory exists
  const dir = filePath.substring(0, filePath.lastIndexOf(sep));
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  // Atomic write: write to .tmp then rename
  const tmpPath = filePath + ".tmp";
  await fsWriteFile(tmpPath, finalContent, "utf-8");
  await fsRename(tmpPath, filePath);

  // Record version for diff cache
  recordVersion(filename, finalContent, finalFm.version);

  return {
    success: true,
    version: finalFm.version,
    path: filePath,
  };
}

/**
 * Edit an existing file with version check.
 */
export async function editFile(options: EditOptions): Promise<EditResult> {
  const { filename, version, operation, section, start_line, end_line, new_content } = options;
  const filePath = resolvePath(filename);

  if (!existsSync(filePath)) {
    throw new Error(`FILE_NOT_FOUND: File '${filename}' does not exist`);
  }

  const rawContent = await fsReadFile(filePath, "utf-8");
  const parsed = parseFrontmatter(rawContent);

  // Record old version in diff cache before editing
  recordVersion(filename, rawContent, parsed.frontmatter.version || 0);

  // Version check
  checkVersion(parsed.frontmatter.version || 0, version);

  let newBody: string;
  let sectionFound = true;
  let linesReplaced = 0;

  const bodyLines = parsed.body.split("\n");

  switch (operation) {
    case "replace_section": {
      if (!section) {
        throw new Error("INTERNAL_ERROR: 'section' is required for replace_section operation");
      }
      const headingPattern = new RegExp(`^##\\s+${escapeRegex(section)}\\s*$`, "m");
      const match = headingPattern.exec(parsed.body);
      if (!match) {
        throw new Error(`SECTION_NOT_FOUND: Section '${section}' not found in '${filename}'`);
      }

      const sectionStart = match.index;
      // Find next ## heading or end of body
      const bodyAfterStart = parsed.body.slice(sectionStart + match[0].length);
      const nextHeadingMatch = bodyAfterStart.match(/^##\s/m);
      let sectionEnd: number;
      if (nextHeadingMatch && nextHeadingMatch.index !== undefined) {
        sectionEnd = sectionStart + match[0].length + nextHeadingMatch.index;
      } else {
        sectionEnd = parsed.body.length;
      }

      const beforeSection = parsed.body.slice(0, sectionStart);
      const afterSection = parsed.body.slice(sectionEnd);
      newBody = beforeSection + match[0] + "\n" + normalizeLineEndings(new_content) + "\n" + afterSection;
      linesReplaced = 1;
      break;
    }

    case "replace_lines": {
      if (start_line === undefined || end_line === undefined) {
        throw new Error("INTERNAL_ERROR: 'start_line' and 'end_line' are required for replace_lines operation");
      }
      // 1-indexed line numbers
      const startIdx = start_line - 1;
      const endIdx = end_line - 1;

      if (startIdx < 0 || endIdx >= bodyLines.length || startIdx > endIdx) {
        throw new Error(
          `INVALID_RANGE: Line range ${start_line}-${end_line} is invalid. File has ${bodyLines.length} body lines.`
        );
      }

      const beforeLines = bodyLines.slice(0, startIdx);
      const afterLines = bodyLines.slice(endIdx + 1);
      const newLines = normalizeLineEndings(new_content).split("\n");
      newBody = [...beforeLines, ...newLines, ...afterLines].join("\n");
      linesReplaced = endIdx - startIdx + 1;
      break;
    }

    case "append": {
      newBody = parsed.body + "\n" + normalizeLineEndings(new_content);
      linesReplaced = 0;
      break;
    }

    case "prepend": {
      newBody = normalizeLineEndings(new_content) + "\n" + parsed.body;
      linesReplaced = 0;
      break;
    }

    default:
      throw new Error(`INTERNAL_ERROR: Unknown operation '${operation}'`);
  }

  const newFm = bumpVersion(parsed.frontmatter);
  const finalContent = serializeContent(newFm, newBody);

  // Atomic write
  const tmpPath = filePath + ".tmp";
  await fsWriteFile(tmpPath, finalContent, "utf-8");
  await fsRename(tmpPath, filePath);

  // Record version for diff cache
  recordVersion(filename, finalContent, newFm.version);

  return {
    success: true,
    version: newFm.version,
    section_found: operation === "replace_section" ? sectionFound : undefined,
    lines_replaced: operation === "replace_lines" ? linesReplaced : undefined,
  };
}

/**
 * List all .md files in the context directory with filtering.
 */
export async function listFiles(
  tag?: string,
  importance?: string,
  pattern?: string,
  includeBody?: boolean
): Promise<ListResult> {
  const dir = config.contextDir;

  if (!existsSync(dir)) {
    return { files: [], total: 0, directory: dir };
  }

  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  let files = entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => join(e.parentPath ?? dir, e.name));

  // Apply glob pattern filter if provided
  if (pattern) {
    const { minimatch } = await import("minimatch");
    files = files.filter((f) => {
      const rel = relative(dir, f).replace(/\\/g, "/");
      return minimatch(rel, pattern);
    });
  }

  const fileInfos: FileInfo[] = [];

  for (const filePath of files) {
    try {
      const stats = await stat(filePath);
      const rawContent = await fsReadFile(filePath, "utf-8");
      const parsed = parseFrontmatter(rawContent);

      // Apply tag filter
      if (tag && parsed.hasFrontmatter) {
        const fmTags = parsed.frontmatter.tags || [];
        if (!fmTags.includes(tag)) continue;
      }

      // Apply importance filter
      if (importance && parsed.hasFrontmatter) {
        if (parsed.frontmatter.importance !== importance) continue;
      }

      const relPath = relative(dir, filePath).replace(/\\/g, "/");

      const info: FileInfo = {
        filename: relPath,
        path: filePath,
        frontmatter: parsed.frontmatter,
        size: stats.size,
        last_modified: stats.mtime.toISOString(),
      };

      if (includeBody && parsed.body) {
        info.body_preview = parsed.body.slice(0, 200).replace(/\n/g, " ");
      }

      fileInfos.push(info);
    } catch {
      // Skip files that error (corrupted, permissions, etc.)
    }
  }

  return {
    files: fileInfos,
    total: fileInfos.length,
    directory: dir,
  };
}

/**
 * Delete a file: move to .trash or permanently delete.
 */
export async function deleteFile(
  filename: string,
  confirm: boolean,
  permanent?: boolean
): Promise<{ success: boolean; trashed_to?: string; permanent: boolean }> {
  if (!confirm) {
    throw new Error(
      "CONFIRMATION_REQUIRED: Set confirm=true to delete this file. This action cannot be undone."
    );
  }

  const filePath = resolvePath(filename);

  if (!existsSync(filePath)) {
    throw new Error(`FILE_NOT_FOUND: File '${filename}' does not exist`);
  }

  if (permanent) {
    await fsUnlink(filePath);
    return { success: true, permanent: true };
  }

  // Move to .trash directory
  const trashDir = join(config.contextDir, ".trash");
  if (!existsSync(trashDir)) {
    await mkdir(trashDir, { recursive: true });
  }

  const trashPath = join(trashDir, filename.replace(/\\/g, "/").split("/").pop() || filename);

  // Avoid overwriting trash files — add timestamp if needed
  let finalTrashPath = trashPath;
  if (existsSync(trashPath)) {
    const ext = filename.endsWith(".md") ? ".md" : "";
    const base = filename.endsWith(".md") ? filename.slice(0, -3) : filename;
    finalTrashPath = join(trashDir, `${base}-${Date.now()}${ext}`);
  }

  await fsRename(filePath, finalTrashPath);

  return {
    success: true,
    trashed_to: finalTrashPath,
    permanent: false,
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
