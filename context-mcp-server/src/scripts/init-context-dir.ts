#!/usr/bin/env node

/**
 * Standalone script to initialize the .context directory with seed files.
 * Run with: tsx src/scripts/init-context-dir.ts
 * 
 * Creates the directory at %USERPROFILE%\.context\ (or CONTEXT_DIR env override)
 * and generates all seed template files (CONTEXT_GUIDE.md, who-i-am.md, etc.)
 * without overwriting existing files.
 */

import { initContextDir } from "../fs/context-dir.js";

async function main() {
  try {
    const result = await initContextDir();
    console.log(`Context directory initialized at: ${result.directory}`);
    console.log("");

    if (result.created.length > 0) {
      console.log("Created files:");
      for (const file of result.created) {
        console.log(`  + ${file}`);
      }
    }

    if (result.skipped.length > 0) {
      console.log("Skipped (already exist):");
      for (const file of result.skipped) {
        console.log(`  ~ ${file}`);
      }
    }

    console.log("");
    console.log("Done. You can now start the MCP server.");
  } catch (err: any) {
    console.error("Failed to initialize context directory:", err.message);
    process.exit(1);
  }
}

main();
