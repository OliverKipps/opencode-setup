import { readdir, readFile as fsReadFile } from "fs/promises";
import { existsSync } from "fs";
import { join, relative } from "path";
import { config } from "../config.js";
import { parseFrontmatter } from "./frontmatter.js";

export interface SearchResultItem {
  filename: string;
  path: string;
  line: number;
  line_content: string;
  match_start: number;
  match_end: number;
}

export interface SearchResults {
  results: SearchResultItem[];
  total_matches: number;
  query: string;
}

export interface SearchOptions {
  query: string;
  case_sensitive?: boolean;
  regex?: boolean;
  max_results?: number;
  filename_filter?: string;
}

/**
 * Walk all .md files in the context directory recursively.
 */
async function findAllMdFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(directory: string): Promise<void> {
    if (!existsSync(directory)) return;

    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        // Skip .trash directory
        if (entry.name === ".trash") continue;
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        results.push(fullPath);
      }
    }
  }

  await walk(dir);
  return results;
}

/**
 * Search across all context files.
 */
export async function searchFiles(options: SearchOptions): Promise<SearchResults> {
  const {
    query,
    case_sensitive = false,
    regex = false,
    max_results = 20,
    filename_filter,
  } = options;

  if (!query || query.trim().length === 0) {
    return { results: [], total_matches: 0, query };
  }

  const mdFiles = await findAllMdFiles(config.contextDir);

  // Apply filename_filter if provided
  let filteredFiles = mdFiles;
  if (filename_filter) {
    const { minimatch } = await import("minimatch");
    filteredFiles = mdFiles.filter((f) => {
      const rel = relative(config.contextDir, f).replace(/\\/g, "/");
      return minimatch(rel, filename_filter);
    });
  }

  const results: SearchResultItem[] = [];
  let totalMatches = 0;

  // Build the matcher function
  const flags = case_sensitive ? "g" : "gi";

  for (const filePath of filteredFiles) {
    if (results.length >= max_results) break;

    const rawContent = await fsReadFile(filePath, "utf-8");
    const parsed = parseFrontmatter(rawContent);
    const body = parsed.body;
    const lines = body.split("\n");

    const relPath = relative(config.contextDir, filePath).replace(/\\/g, "/");

    for (let i = 0; i < lines.length; i++) {
      if (results.length >= max_results) break;

      const line = lines[i];

      if (regex) {
        try {
          const re = new RegExp(query, flags);
          const match = re.exec(line);
          if (match) {
            const matchStart = match.index;
            const matchEnd = matchStart + match[0].length;
            results.push({
              filename: relPath,
              path: filePath,
              line: i + 1,
              line_content: line,
              match_start: matchStart,
              match_end: matchEnd,
            });
            totalMatches++;
          }
        } catch {
          // Invalid regex — skip this file/line
          continue;
        }
      } else {
        const searchLine = case_sensitive ? line : line.toLowerCase();
        const searchQuery = case_sensitive ? query : query.toLowerCase();
        const idx = searchLine.indexOf(searchQuery);
        if (idx !== -1) {
          results.push({
            filename: relPath,
            path: filePath,
            line: i + 1,
            line_content: line,
            match_start: idx,
            match_end: idx + query.length,
          });
          totalMatches++;
        }
      }
    }
  }

  return {
    results,
    total_matches: totalMatches,
    query,
  };
}
