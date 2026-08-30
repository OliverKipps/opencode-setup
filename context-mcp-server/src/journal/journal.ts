import { readFile as fsReadFile, writeFile as fsWriteFile, rename as fsRename } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";
import { parseFrontmatter, bumpVersion, serializeContent, normalizeLineEndings } from "../fs/frontmatter.js";

export interface JournalEntry {
  content: string;
  source: "opencode" | "chatgpt" | "claude" | "gemini" | "manual";
  session_id?: string;
  files_accessed?: string[];
}

export interface JournalResult {
  success: boolean;
  entry_id: string;
  timestamp: string;
}

/**
 * Append a journal entry to journal.md.
 * Reads the current file, appends a formatted entry, and writes back with version bump.
 */
export async function appendJournalEntry(entry: JournalEntry): Promise<JournalResult> {
  const { content, source, session_id, files_accessed } = entry;
  const journalPath = join(config.contextDir, "journal.md");

  const entryId = uuidv4();
  const now = new Date();
  const timestamp = now.toISOString();

  // Build the journal entry section
  const entryParts: string[] = [];
  entryParts.push(`## Session: ${timestamp}`);
  entryParts.push("");
  entryParts.push(`**Source:** ${source}`);
  if (session_id) {
    entryParts.push(`**Session ID:** ${session_id}`);
  }
  if (files_accessed && files_accessed.length > 0) {
    entryParts.push(`**Files Accessed:** ${files_accessed.join(", ")}`);
  }
  entryParts.push("");
  entryParts.push(content.trim());
  entryParts.push("");

  const entryText = entryParts.join("\n");

  if (!existsSync(journalPath)) {
    // Create journal.md with frontmatter and the entry
    const { generateFrontmatter } = await import("../fs/frontmatter.js");
    const fm = generateFrontmatter("journal", "Session Journal");
    fm.importance = "medium";
    fm.tags = ["journal", "log", "sessions"];

    const body = `# Session Journal\n\n<!-- New entries are appended here by context_append_journal -->\n\n${entryText}`;
    const finalContent = serializeContent(fm, body);

    await fsWriteFile(journalPath, finalContent, "utf-8");

    return {
      success: true,
      entry_id: entryId,
      timestamp,
    };
  }

  // Read existing journal
  const rawContent = await fsReadFile(journalPath, "utf-8");
  const parsed = parseFrontmatter(rawContent);

  // Append new entry after the existing body
  const newBody = (parsed.body || "").trimEnd() + "\n\n" + entryText;

  const newFm = bumpVersion(parsed.frontmatter);
  const finalContent = serializeContent(newFm, newBody);

  // Atomic write
  const tmpPath = journalPath + ".tmp";
  await fsWriteFile(tmpPath, finalContent, "utf-8");
  await fsRename(tmpPath, journalPath);

  return {
    success: true,
    entry_id: entryId,
    timestamp,
  };
}
