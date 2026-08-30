import { homedir } from "os";
import { resolve, join } from "path";

export type ServerMode = "stdio" | "sse" | "dual";

export interface Config {
  /** Absolute path to the .context directory */
  contextDir: string;
  /** Maximum allowed file size in bytes (default 1MB) */
  maxFileSize: number;
  /** Number of versions to keep in memory cache */
  versionCacheSize: number;
  /** Trash directory path */
  trashDir: string;
  /** Server mode: stdio, sse, or dual */
  mode: ServerMode;
  /** Port for SSE/HTTP server */
  port: number;
}

function resolveContextDir(): string {
  const envDir = process.env.CONTEXT_DIR;
  if (envDir && envDir.trim().length > 0) {
    return resolve(envDir.trim());
  }

  const home = homedir();
  return join(home, ".context");
}

function parseMaxFileSize(): number {
  const envVal = process.env.CONTEXT_MAX_FILE_SIZE;
  if (envVal && envVal.trim().length > 0) {
    const parsed = parseInt(envVal.trim(), 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 1_048_576; // 1MB default
}

function parseVersionCacheSize(): number {
  const envVal = process.env.CONTEXT_VERSION_CACHE;
  if (envVal && envVal.trim().length > 0) {
    const parsed = parseInt(envVal.trim(), 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 5;
}

function parseMode(): ServerMode {
  const envVal = process.env.CONTEXT_MODE;
  if (envVal) {
    const trimmed = envVal.trim().toLowerCase();
    if (trimmed === "sse" || trimmed === "dual") {
      return trimmed;
    }
  }
  return "stdio";
}

function parsePort(): number {
  const envVal = process.env.CONTEXT_PORT;
  if (envVal && envVal.trim().length > 0) {
    const parsed = parseInt(envVal.trim(), 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) {
      return parsed;
    }
  }
  return 3100;
}

export const config: Config = {
  contextDir: resolveContextDir(),
  maxFileSize: parseMaxFileSize(),
  versionCacheSize: parseVersionCacheSize(),
  get trashDir() {
    return join(this.contextDir, ".trash");
  },
  mode: parseMode(),
  port: parsePort(),
};
