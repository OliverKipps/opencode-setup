import { v4 as uuidv4 } from "uuid";
import { stat, readFile as fsReadFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { config } from "../config.js";
import { readFile, editFile, resolvePath } from "../fs/file-ops.js";
import { parseFrontmatter, normalizeLineEndings } from "../fs/frontmatter.js";

export interface PruneSuggestion {
  feedback_entry_id: string;
  success: boolean;
  file_flagged: boolean;
}

export interface PruneOptions {
  filename: string;
  reason: string;
  section?: string;
  suggested_action?: "review" | "rewrite" | "delete" | "archive";
  importance?: "critical" | "high" | "medium" | "low";
}

export interface StalenessInfo {
  filename: string;
  days_since_update: number;
  importance: string;
  staleness_score: "none" | "low" | "medium" | "high" | "critical";
  stale: boolean;
  reason?: string;
}

/**
 * Suggest a file or section for pruning.
 * Effects:
 * 1. Appends a timestamped entry to feedback.md
 * 2. Sets stale: true in the file's frontmatter (if file exists)
 */
export async function suggestPrune(options: PruneOptions): Promise<PruneSuggestion> {
  const { filename, reason, section, suggested_action = "review", importance = "low" } = options;
  const entryId = uuidv4();
  const timestamp = new Date().toISOString();
  let fileFlagged = false;

  // 1. Append entry to feedback.md
  const feedbackEntry = `
## Suggestion: ${timestamp}

**Entry ID:** ${entryId}
**File:** ${filename}${section ? ` (section: ${section})` : ""}
**Suggested Action:** ${suggested_action}
**Importance:** ${importance}

**Reason:** ${reason}
`;

  // Read current feedback.md to get version
  const feedbackPath = resolvePath("feedback.md");
  if (existsSync(feedbackPath)) {
    const current = await readFile("feedback.md");
    if (current.exists) {
      await editFile({
        filename: "feedback.md",
        version: current.version,
        operation: "append",
        new_content: feedbackEntry,
      });
    }
  }

  // 2. Set stale flag in the file's frontmatter (if file exists)
  try {
    const filePath = resolvePath(filename);
    if (existsSync(filePath)) {
      const current = await readFile(filename);
      if (current.exists) {
        // Update frontmatter: set stale: true and stale_reason
        const updatedFm = {
          ...current.frontmatter,
          stale: true,
          stale_reason: reason,
          updated: new Date().toISOString(),
        };

        // Rebuild file content with updated frontmatter
        const fmLines: string[] = ["---"];
        fmLines.push(`id: ${updatedFm.id}`);
        fmLines.push(`title: "${escapeYamlValue(String(updatedFm.title))}"`);
        fmLines.push(`created: "${isoString(updatedFm.created)}"`);
        fmLines.push(`updated: "${isoString(updatedFm.updated)}"`);
        fmLines.push(`version: ${updatedFm.version}`);

        if (updatedFm.importance) fmLines.push(`importance: ${updatedFm.importance}`);
        if (updatedFm.tags && updatedFm.tags.length > 0) {
          fmLines.push("tags:");
          for (const tag of updatedFm.tags) fmLines.push(`  - ${tag}`);
        } else {
          fmLines.push("tags: []");
        }
        if (updatedFm.source) fmLines.push(`source: ${updatedFm.source}`);
        fmLines.push(`stale: true`);
        fmLines.push(`stale_reason: "${escapeYamlValue(reason)}"`);
        fmLines.push("---");

        const newContent = fmLines.join("\n") + "\n" + current.body;

        // Use editFile with replace_lines to replace entire content
        // Simpler: write directly using the FS
        const { writeFile } = await import("../fs/file-ops.js");
        await writeFile(filename, newContent, true, current.version);
        fileFlagged = true;
      }
    }
  } catch (err) {
    // File doesn't exist or can't be updated — that's OK, feedback was still recorded
    console.error(`[context-mcp-server] Could not flag file '${filename}' for pruning: ${err}`);
  }

  return {
    feedback_entry_id: entryId,
    success: true,
    file_flagged: fileFlagged,
  };
}

/**
 * Compute staleness scores for all context files.
 * Used by context_list with optional staleness filtering.
 */
export async function computeStalenessScores(): Promise<StalenessInfo[]> {
  const { readdir } = await import("fs/promises");
  const dir = config.contextDir;

  if (!existsSync(dir)) return [];

  const entries = await readdir(dir, { withFileTypes: true });
  const mdFiles = entries.filter(
    (e) => e.isFile() && e.name.endsWith(".md") && e.name !== "CONTEXT_GUIDE.md"
  );

  const results: StalenessInfo[] = [];
  const now = Date.now();

  for (const entry of mdFiles) {
    try {
      const filePath = join(dir, entry.name);
      const stats = await stat(filePath);
      const daysSinceUpdate = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);
      const rawContent = await fsReadFile(filePath, "utf-8");
      const parsed = parseFrontmatter(rawContent);

      const importance = parsed.frontmatter.importance || "medium";
      let score: StalenessInfo["staleness_score"] = "none";
      let reason: string | undefined;

      if (daysSinceUpdate > 90) {
        score = "critical";
        reason = `Not updated in ${Math.round(daysSinceUpdate)} days. Review and update or archive.`;
      } else if (daysSinceUpdate > 60 && importance === "medium") {
        score = "high";
        reason = `Not updated in ${Math.round(daysSinceUpdate)} days (medium importance).`;
      } else if (daysSinceUpdate > 30 && importance === "low") {
        score = "high";
        reason = `Not updated in ${Math.round(daysSinceUpdate)} days (low importance).`;
      } else if (daysSinceUpdate > 60) {
        score = "medium";
      } else if (daysSinceUpdate > 30) {
        score = "low";
      }

      results.push({
        filename: entry.name,
        days_since_update: Math.round(daysSinceUpdate),
        importance,
        staleness_score: score,
        stale: parsed.frontmatter.stale === true,
        reason,
      });
    } catch {
      // Skip files that error
    }
  }

  return results.sort((a, b) => {
    const scoreOrder = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };
    return (scoreOrder[b.staleness_score] || 0) - (scoreOrder[a.staleness_score] || 0);
  });
}

function escapeYamlValue(value: string): string {
  if (value.includes('"') || value.includes("\n") || value.includes(":")) {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }
  return value;
}

function isoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return String(value);
}
