import { describe, it, expect } from "vitest";
import {
  parseFrontmatter,
  validateFrontmatter,
  generateFrontmatter,
  bumpVersion,
  serializeContent,
  normalizeLineEndings,
} from "./frontmatter.js";

describe("parseFrontmatter", () => {
  it("parses valid YAML frontmatter", () => {
    const result = parseFrontmatter("---\nid: test\nversion: 1\n---\nbody content");
    expect(result.hasFrontmatter).toBe(true);
    expect(result.frontmatter.id).toBe("test");
    expect(result.frontmatter.version).toBe(1);
    expect(result.body).toBe("body content");
  });

  it("handles content without frontmatter", () => {
    const result = parseFrontmatter("just body content\nno frontmatter");
    expect(result.hasFrontmatter).toBe(false);
    expect(Object.keys(result.frontmatter)).toHaveLength(0);
    expect(result.body).toBe("just body content\nno frontmatter");
  });

  it("handles empty content", () => {
    const result = parseFrontmatter("");
    expect(result.hasFrontmatter).toBe(false);
    expect(result.body).toBe("");
  });

  it("parses frontmatter with tags array", () => {
    const content = "---\nid: test\ntags:\n  - a\n  - b\n---\nbody";
    const result = parseFrontmatter(content);
    expect(result.frontmatter.tags).toEqual(["a", "b"]);
  });
});

describe("validateFrontmatter", () => {
  it("passes for valid frontmatter", () => {
    expect(() =>
      validateFrontmatter({
        id: "test",
        title: "Test",
        created: "2025-01-01",
        updated: "2025-01-01",
        version: 1,
      })
    ).not.toThrow();
  });

  it("throws for missing required fields", () => {
    expect(() =>
      validateFrontmatter({ id: "test" } as any)
    ).toThrow("INVALID_FRONTMATTER");
  });

  it("throws for missing version field", () => {
    expect(() =>
      validateFrontmatter({
        id: "test",
        title: "Test",
        created: "2025-01-01",
        updated: "2025-01-01",
        version: undefined,
      } as any)
    ).toThrow("version");
  });

  it("throws for non-positive version", () => {
    expect(() =>
      validateFrontmatter({
        id: "test",
        title: "Test",
        created: "2025-01-01",
        updated: "2025-01-01",
        version: 0,
      })
    ).toThrow("positive integer");
  });

  it("throws for non-numeric version", () => {
    expect(() =>
      validateFrontmatter({
        id: "test",
        title: "Test",
        created: "2025-01-01",
        updated: "2025-01-01",
        version: "abc" as any,
      })
    ).toThrow("positive integer");
  });
});

describe("generateFrontmatter", () => {
  it("creates frontmatter with correct id and title", () => {
    const fm = generateFrontmatter("my-file", "My File");
    expect(fm.id).toBe("my-file");
    expect(fm.title).toBe("My File");
  });

  it("starts with version 1", () => {
    const fm = generateFrontmatter("test", "Test");
    expect(fm.version).toBe(1);
  });

  it("sets default importance to medium", () => {
    const fm = generateFrontmatter("test", "Test");
    expect(fm.importance).toBe("medium");
  });

  it("sets timestamps to valid ISO strings", () => {
    const fm = generateFrontmatter("test", "Test");
    expect(() => new Date(fm.created)).not.toThrow();
    expect(() => new Date(fm.updated)).not.toThrow();
  });
});

describe("bumpVersion", () => {
  it("increments version by 1", () => {
    const fm = generateFrontmatter("test", "Test");
    const bumped = bumpVersion(fm);
    expect(bumped.version).toBe(fm.version + 1);
  });

  it("updates the updated timestamp", () => {
    const fm = generateFrontmatter("test", "Test");
    const bumped = bumpVersion(fm);
    expect(() => new Date(bumped.updated)).not.toThrow();
    expect(bumped.version).toBe(fm.version + 1);
  });

  it("preserves other fields", () => {
    const fm = generateFrontmatter("test", "Test");
    fm.tags = ["a", "b"];
    const bumped = bumpVersion(fm);
    expect(bumped.tags).toEqual(["a", "b"]);
    expect(bumped.id).toBe("test");
  });
});

describe("serializeContent", () => {
  it("creates valid frontmatter with body", () => {
    const fm = generateFrontmatter("test", "Test");
    const result = serializeContent(fm, "Hello world");
    expect(result.startsWith("---")).toBe(true);
    expect(result).toContain("id: test");
    expect(result).toContain("Hello world");
  });

  it("round-trips through parseFrontmatter", () => {
    const fm = generateFrontmatter("roundtrip", "Round Trip");
    fm.importance = "high";
    fm.tags = ["test", "demo"];
    const serialized = serializeContent(fm, "# Body\n\nContent here.");
    const parsed = parseFrontmatter(serialized);
    expect(parsed.frontmatter.id).toBe("roundtrip");
    expect(parsed.frontmatter.importance).toBe("high");
    expect(parsed.frontmatter.tags).toEqual(["test", "demo"]);
    expect(parsed.body).toContain("Content here.");
  });

  it("serializes tags array correctly", () => {
    const fm = generateFrontmatter("test", "Test");
    fm.tags = ["alpha", "beta"];
    const result = serializeContent(fm, "body");
    expect(result).toContain("tags:");
    expect(result).toContain("- alpha");
    expect(result).toContain("- beta");
  });

  it("serializes empty tags as 'tags: []'", () => {
    const fm = generateFrontmatter("test", "Test");
    fm.tags = [];
    const result = serializeContent(fm, "body");
    expect(result).toContain("tags: []");
  });
});

describe("normalizeLineEndings", () => {
  it("converts CRLF to LF", () => {
    expect(normalizeLineEndings("line1\r\nline2\r\nline3")).toBe("line1\nline2\nline3");
  });

  it("converts CR to LF", () => {
    expect(normalizeLineEndings("line1\rline2\rline3")).toBe("line1\nline2\nline3");
  });

  it("preserves LF", () => {
    expect(normalizeLineEndings("line1\nline2\nline3")).toBe("line1\nline2\nline3");
  });

  it("handles mixed line endings", () => {
    expect(normalizeLineEndings("line1\r\nline2\rline3\nline4")).toBe("line1\nline2\nline3\nline4");
  });

  it("handles empty string", () => {
    expect(normalizeLineEndings("")).toBe("");
  });
});
