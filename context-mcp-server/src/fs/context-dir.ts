import { mkdir, writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { config } from "../config.js";
import {
  CONTEXT_GUIDE_MD,
  whoIAmTemplate,
  goalsTemplate,
  preferencesTemplate,
  journalTemplate,
  feedbackTemplate,
} from "../templates/index.js";

export interface SeedFile {
  filename: string;
  content: string;
}

/**
 * Get all seed file definitions with their content.
 */
export function getSeedFiles(): SeedFile[] {
  return [
    { filename: "CONTEXT_GUIDE.md", content: CONTEXT_GUIDE_MD },
    { filename: "who-i-am.md", content: whoIAmTemplate() },
    { filename: "goals.md", content: goalsTemplate() },
    { filename: "preferences-and-habits.md", content: preferencesTemplate() },
    { filename: "journal.md", content: journalTemplate() },
    { filename: "feedback.md", content: feedbackTemplate() },
  ];
}

/**
 * Initialize the context directory.
 * Creates the directory if it doesn't exist, then writes seed files
 * only if they don't already exist.
 *
 * Returns a summary of what was created.
 */
export async function initContextDir(): Promise<{
  directory: string;
  created: string[];
  skipped: string[];
}> {
  const dir = config.contextDir;
  const created: string[] = [];
  const skipped: string[] = [];

  // Create context directory
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  // Write seed files (only if they don't exist)
  const seedFiles = getSeedFiles();
  for (const { filename, content } of seedFiles) {
    const filePath = join(dir, filename);
    if (!existsSync(filePath)) {
      await writeFile(filePath, content, "utf-8");
      created.push(filename);
    } else {
      skipped.push(filename);
    }
  }

  return {
    directory: dir,
    created,
    skipped,
  };
}

/**
 * Check if the context directory has been initialized
 * (i.e., CONTEXT_GUIDE.md exists).
 */
export function isContextDirInitialized(): boolean {
  const guidePath = join(config.contextDir, "CONTEXT_GUIDE.md");
  return existsSync(guidePath);
}
