import matter from "gray-matter";

export interface Frontmatter {
  id: string;
  title: string;
  created: string;
  updated: string;
  version: number;
  importance?: "critical" | "high" | "medium" | "low" | "archived";
  tags?: string[];
  source?: string;
  stale?: boolean;
  stale_reason?: string | null;
  [key: string]: unknown;
}

export interface ParsedFile {
  /** Raw frontmatter object */
  frontmatter: Frontmatter;
  /** Markdown body (without frontmatter) */
  body: string;
  /** Full content (frontmatter + body) */
  content: string;
  /** Whether frontmatter was found and parsed */
  hasFrontmatter: boolean;
}

const REQUIRED_FIELDS: (keyof Frontmatter)[] = ["id", "title", "created", "updated", "version"];

/**
 * Parse YAML frontmatter from file content.
 * Returns the frontmatter object, body, and full content.
 */
export function parseFrontmatter(content: string): ParsedFile {
  const parsed = matter(content);
  const frontmatter = (parsed.data || {}) as Frontmatter;
  const body = parsed.content || "";
  return {
    frontmatter,
    body,
    content,
    hasFrontmatter: Object.keys(frontmatter).length > 0,
  };
}

/**
 * Validate that required frontmatter fields exist.
 * Throws with specific field names if missing.
 */
export function validateFrontmatter(fm: Frontmatter): void {
  const missing = REQUIRED_FIELDS.filter((f) => fm[f] === undefined || fm[f] === null);
  if (missing.length > 0) {
    throw new Error(
      `INVALID_FRONTMATTER: Missing required fields: ${missing.join(", ")}`
    );
  }
  if (typeof fm.version !== "number" || fm.version < 1) {
    throw new Error(
      `INVALID_FRONTMATTER: 'version' must be a positive integer, got ${fm.version}`
    );
  }
}

/**
 * Generate default frontmatter for a new file.
 */
export function generateFrontmatter(id: string, title: string): Frontmatter {
  const now = new Date().toISOString();
  return {
    id,
    title,
    created: now,
    updated: now,
    version: 1,
    importance: "medium",
    tags: [],
    source: "manual",
    stale: false,
    stale_reason: null,
  };
}

/**
 * Increment version and update timestamp.
 */
export function bumpVersion(fm: Frontmatter): Frontmatter {
  return {
    ...fm,
    version: fm.version + 1,
    updated: new Date().toISOString(),
  };
}

/**
 * Serialize frontmatter + body into a full markdown string.
 * This generates frontmatter manually (not using gray-matter) for simpler control.
 */
export function serializeContent(fm: Frontmatter, body: string): string {
  const fmLines: string[] = ["---"];
  fmLines.push(`id: ${fm.id}`);
  fmLines.push(`title: "${escapeYamlValue(String(fm.title))}"`);
  fmLines.push(`created: "${escapeYamlValue(isoString(fm.created))}"`);
  fmLines.push(`updated: "${escapeYamlValue(isoString(fm.updated))}"`);
  fmLines.push(`version: ${fm.version}`);

  if (fm.importance) {
    fmLines.push(`importance: ${fm.importance}`);
  }

  if (fm.tags && fm.tags.length > 0) {
    fmLines.push("tags:");
    for (const tag of fm.tags) {
      fmLines.push(`  - ${tag}`);
    }
  } else {
    fmLines.push("tags: []");
  }

  if (fm.source) {
    fmLines.push(`source: ${fm.source}`);
  }

  if (fm.stale !== undefined) {
    fmLines.push(`stale: ${fm.stale}`);
  }

  if (fm.stale_reason !== undefined && fm.stale_reason !== null) {
    fmLines.push(`stale_reason: "${escapeYamlValue(fm.stale_reason)}"`);
  }

  fmLines.push("---");

  const bodyStr = body || "";
  return fmLines.join("\n") + "\n" + bodyStr;
}

/**
 * Convert a value to ISO string safely.
 * Handles Date objects (from YAML parsing) and strings.
 */
function isoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return String(value);
}

function escapeYamlValue(value: string): string {
  if (value.includes('"') || value.includes("\n") || value.includes(":")) {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }
  return value;
}

/**
 * Normalize line endings to LF.
 */
export function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}
