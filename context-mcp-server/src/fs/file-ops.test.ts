import { vi, beforeAll, afterAll, describe, it, expect } from "vitest";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const testDir = vi.hoisted(() => {
  const { mkdtempSync } = require("fs");
  const { join: j } = require("path");
  const { tmpdir } = require("os");
  return mkdtempSync(j(tmpdir(), "context-mcp-fileops-"));
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

import {
  validateFilename,
  readFile,
  writeFile,
  editFile,
  deleteFile,
  listFiles,
} from "./file-ops.js";

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

describe("validateFilename", () => {
  it("accepts valid filenames", () => {
    expect(validateFilename("test.md")).toBe("test.md");
    expect(validateFilename("subdir/file.md")).toBe("subdir/file.md");
    expect(validateFilename("my-file.md")).toBe("my-file.md");
  });

  it("rejects empty filenames", () => {
    expect(() => validateFilename("")).toThrow("PATH_TRAVERSAL");
  });

  it("rejects parent directory traversal", () => {
    expect(() => validateFilename("../foo.md")).toThrow("PATH_TRAVERSAL");
    expect(() => validateFilename("a/../../b.md")).toThrow("PATH_TRAVERSAL");
  });

  it("rejects absolute paths", () => {
    expect(() => validateFilename("/etc/passwd")).toThrow("PATH_TRAVERSAL");
    expect(() => validateFilename("C:\\foo.md")).toThrow("PATH_TRAVERSAL");
  });

  it("rejects null bytes", () => {
    expect(() => validateFilename("test\0.md")).toThrow("PATH_TRAVERSAL");
  });

  it("rejects current directory references", () => {
    expect(() => validateFilename("./file.md")).toThrow("PATH_TRAVERSAL");
  });

  it("normalizes backslashes to forward slashes", () => {
    const result = validateFilename("subdir\\file.md");
    expect(result).toBe("subdir/file.md");
  });
});

describe("writeFile and readFile", () => {
  it("writes a new file and reads it back", async () => {
    const content = fullFm("new-test", 1) + "Hello world";
    const result = await writeFile("new-test.md", content);
    expect(result.success).toBe(true);
    expect(result.version).toBe(1);

    const read = await readFile("new-test.md");
    expect(read.exists).toBe(true);
    expect(read.body).toBe("Hello world");
  });

  it("fails to write without overwrite flag when file exists", async () => {
    await writeFile("existing-test.md", fullFm("existing", 1) + "original", true);
    await expect(writeFile("existing-test.md", fullFm("existing", 2) + "new")).rejects.toThrow("FILE_EXISTS");
  });

  it("overwrites with overwrite flag", async () => {
    await writeFile("overwrite-test.md", fullFm("overwrite", 1) + "v1", true);
    const result = await writeFile("overwrite-test.md", fullFm("overwrite", 2) + "v2", true);
    expect(result.success).toBe(true);
    expect(result.version).toBe(2);
  });

  it("generates frontmatter for content without it", async () => {
    const result = await writeFile("no-frontmatter.md", "Just a body");
    expect(result.success).toBe(true);
    expect(result.version).toBe(1);

    const read = await readFile("no-frontmatter.md");
    expect(read.frontmatter.id).toBeTruthy();
    expect(read.body).toBe("Just a body");
  });

  it("returns exists=false for unreadable files", async () => {
    const read = await readFile("nonexistent-file.md");
    expect(read.exists).toBe(false);
    expect(read.version).toBe(0);
  });

  it("enforces version check on overwrite", async () => {
    await writeFile("version-check.md", fullFm("version-check", 1) + "original", true);
    await expect(
      writeFile("version-check.md", fullFm("version-check", 3) + "new", true, 99)
    ).rejects.toThrow("VERSION_MISMATCH");
  });
});

describe("editFile", () => {
  it("appends content", async () => {
    await writeFile("edit-append.md", fullFm("edit-append", 1) + "line1\nline2", true);
    const result = await editFile({
      filename: "edit-append.md",
      version: 1,
      operation: "append",
      new_content: "line3",
    });
    expect(result.success).toBe(true);
    expect(result.version).toBe(2);

    const read = await readFile("edit-append.md");
    expect(read.body).toContain("line3");
  });

  it("prepends content", async () => {
    await writeFile("edit-prepend.md", fullFm("edit-prepend", 1) + "original", true);
    const result = await editFile({
      filename: "edit-prepend.md",
      version: 1,
      operation: "prepend",
      new_content: "prefix",
    });
    expect(result.success).toBe(true);
    expect(result.version).toBe(2);

    const read = await readFile("edit-prepend.md");
    expect(read.body).toBe("prefix\noriginal");
  });

  it("replaces a section by heading", async () => {
    const body = "## Section A\n\na content\n\n## Section B\n\nb content";
    await writeFile("edit-section.md", fullFm("edit-section", 1) + body, true);
    const result = await editFile({
      filename: "edit-section.md",
      version: 1,
      operation: "replace_section",
      section: "Section A",
      new_content: "new a content",
    });
    expect(result.success).toBe(true);
    expect(result.version).toBe(2);

    const read = await readFile("edit-section.md");
    expect(read.body).toContain("## Section A");
    expect(read.body).toContain("new a content");
    expect(read.body).toContain("## Section B");
  });

  it("replaces line range", async () => {
    const body = "line1\nline2\nline3\nline4";
    await writeFile("edit-lines.md", fullFm("edit-lines", 1) + body, true);
    const result = await editFile({
      filename: "edit-lines.md",
      version: 1,
      operation: "replace_lines",
      start_line: 2,
      end_line: 3,
      new_content: "replacement",
    });
    expect(result.success).toBe(true);
    expect(result.lines_replaced).toBe(2);

    const read = await readFile("edit-lines.md");
    expect(read.body).toBe("line1\nreplacement\nline4");
  });

  it("throws for non-existent file", async () => {
    await expect(
      editFile({
        filename: "no-such-file.md",
        version: 1,
        operation: "append",
        new_content: "test",
      })
    ).rejects.toThrow("FILE_NOT_FOUND");
  });

  it("throws on version mismatch", async () => {
    await writeFile("edit-version.md", fullFm("edit-version", 1) + "content", true);
    await expect(
      editFile({
        filename: "edit-version.md",
        version: 99,
        operation: "append",
        new_content: "test",
      })
    ).rejects.toThrow("VERSION_MISMATCH");
  });
});

describe("deleteFile", () => {
  it("moves file to trash", async () => {
    await writeFile("to-trash.md", fullFm("to-trash", 1) + "trash me", true);
    const result = await deleteFile("to-trash.md", true);
    expect(result.success).toBe(true);
    expect(result.permanent).toBe(false);
    expect(result.trashed_to).toBeTruthy();
  });

  it("permanently deletes with permanent flag", async () => {
    await writeFile("to-delete.md", fullFm("to-delete", 1) + "delete me", true);
    const result = await deleteFile("to-delete.md", true, true);
    expect(result.success).toBe(true);
    expect(result.permanent).toBe(true);
  });

  it("throws without confirmation", async () => {
    await expect(deleteFile("any-file.md", false)).rejects.toThrow("CONFIRMATION_REQUIRED");
  });

  it("throws for non-existent file", async () => {
    await expect(deleteFile("ghost.md", true)).rejects.toThrow("FILE_NOT_FOUND");
  });
});

describe("listFiles", () => {
  it("lists files with frontmatter metadata", async () => {
    await writeFile("list-test-a.md", fullFm("list-a", 1) + "body a", true);
    await writeFile("list-test-b.md", fullFm("list-b", 1) + "body b", true);

    const result = await listFiles();
    const filenames = result.files.map((f) => f.filename);
    expect(filenames).toContain("list-test-a.md");
    expect(filenames).toContain("list-test-b.md");
  });

  it("filters by tag", async () => {
    const tagged = `---\nid: tagged\ntitle: "Tagged"\ncreated: "2025-01-01T00:00:00.000Z"\nupdated: "2025-01-01T00:00:00.000Z"\nversion: 1\ntags:\n  - special\n---\nbody`;
    await writeFile("tagged-file.md", tagged, true);
    const result = await listFiles("special");
    const filenames = result.files.map((f) => f.filename);
    expect(filenames).toContain("tagged-file.md");
  });
});
