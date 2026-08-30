#!/usr/bin/env node

import { homedir } from "os";
import { resolve } from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const VALID_MODES = ["stdio", "sse", "dual"] as const;

interface CliArgs {
  port?: number;
  mode?: string;
  dir?: string;
  help?: boolean;
  version?: boolean;
}

const KNOWN_FLAGS = ["port", "mode", "dir", "help", "version"];

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  const raw = argv.slice(2);

  for (let i = 0; i < raw.length; i++) {
    const arg = raw[i];

    if (!arg.startsWith("--")) {
      console.error(`[context-server] Unknown argument: ${arg}`);
      process.exit(1);
    }

    const key = arg.slice(2);

    if (key === "help") {
      args.help = true;
      continue;
    }

    if (key === "version") {
      args.version = true;
      continue;
    }

    if (!KNOWN_FLAGS.includes(key)) {
      console.error(`[context-server] Unknown option: --${key}`);
      process.exit(1);
    }

    if (i + 1 >= raw.length || raw[i + 1].startsWith("--")) {
      console.error(`[context-server] --${key} requires a value`);
      process.exit(1);
    }

    const value = raw[++i];
    args[key as keyof CliArgs] = value as any;
  }

  return args;
}

function showHelp(): void {
  console.log(`
  context-server — CONTEXT MCP Server

  Usage:
    context-server [options]

  Options:
    --port <number>   Port for SSE/HTTP server          (default: 3100)
    --mode <mode>     Server mode: stdio | sse | dual   (default: stdio)
    --dir <path>      Context directory path             (default: ~/.context)
    --help            Show this help message
    --version         Show version number
  `);
  process.exit(0);
}

function readVersion(): string {
  try {
    const pkgPath = join(__dirname, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function main(): void {
  const args = parseArgs(process.argv);

  if (args.help) showHelp();

  if (args.version) {
    console.log(readVersion());
    process.exit(0);
  }

  if (args.dir !== undefined) {
    const dirStr = String(args.dir).trim();
    if (dirStr.length === 0) {
      console.error("[context-server] --dir requires a non-empty path");
      process.exit(1);
    }
    process.env.CONTEXT_DIR = resolve(dirStr.replace(/^~/, homedir()));
  }

  if (args.mode) {
    const mode = String(args.mode).toLowerCase();
    if (!VALID_MODES.includes(mode as any)) {
      console.error(`[context-server] Invalid mode: "${args.mode}". Valid modes: ${VALID_MODES.join(", ")}`);
      process.exit(1);
    }
    process.env.CONTEXT_MODE = mode;
  }

  if (args.port !== undefined) {
    const port = Number(args.port);
    if (isNaN(port) || port <= 0 || port > 65535) {
      console.error(`[context-server] Invalid port: "${args.port}". Must be a number between 1 and 65535.`);
      process.exit(1);
    }
    process.env.CONTEXT_PORT = String(port);
  }

  import("./index.js").catch((err: Error) => {
    console.error(`[context-server] Failed to start server: ${err.message}`);
    process.exit(1);
  });
}

main();
