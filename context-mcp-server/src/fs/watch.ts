import { watch as chokidarWatch, FSWatcher } from "chokidar";
import { config } from "../config.js";

export interface WatchSubscription {
  id: string;
  filename?: string;
  events: string[];
  sessionId: string;
}

const subscriptions: Map<string, WatchSubscription> = new Map();
let watcher: FSWatcher | null = null;
let watcherReady = false;

/**
 * Create or return the shared chokidar watcher for the context directory.
 */
export function createWatcher(): FSWatcher {
  if (watcher) return watcher;

  watcher = chokidarWatch(config.contextDir, {
    persistent: true,
    ignoreInitial: true,
    ignored: /[/\\]\.trash[/\\]/,
    depth: 10,
  });

  watcher.on("ready", () => {
    watcherReady = true;
  });

  // Log watcher errors
  watcher.on("error", (err: any) => {
    console.error(`[context-mcp-server] Watcher error: ${err.message}`);
  });

  return watcher;
}

/**
 * Add a subscription for file change notifications.
 */
export function addSubscription(sub: WatchSubscription): void {
  subscriptions.set(sub.id, sub);
}

/**
 * Remove a subscription by ID.
 */
export function removeSubscription(id: string): void {
  subscriptions.delete(id);
}

/**
 * Get all subscriptions for a given session.
 */
export function getSubscriptionsForSession(sessionId: string): WatchSubscription[] {
  const result: WatchSubscription[] = [];
  for (const sub of subscriptions.values()) {
    if (sub.sessionId === sessionId) {
      result.push(sub);
    }
  }
  return result;
}

/**
 * Clear all subscriptions for a session.
 */
export function clearSessionSubscriptions(sessionId: string): void {
  for (const [id, sub] of subscriptions) {
    if (sub.sessionId === sessionId) {
      subscriptions.delete(id);
    }
  }
}

/**
 * Check if a file matches a subscription's filter.
 */
export function matchesSubscription(filePath: string, sub: WatchSubscription): boolean {
  if (!sub.filename) return true; // Watch all files
  return filePath.replace(/\\/g, "/").endsWith(sub.filename);
}

/**
 * Get all subscriptions.
 */
export function getAllSubscriptions(): WatchSubscription[] {
  return Array.from(subscriptions.values());
}

/**
 * Close the watcher and clear all subscriptions.
 */
export async function closeWatcher(): Promise<void> {
  if (watcher) {
    await watcher.close();
    watcher = null;
    watcherReady = false;
  }
  subscriptions.clear();
}

/**
 * Check if the watcher is ready.
 */
export function isWatcherReady(): boolean {
  return watcherReady;
}

// Legacy API for backward compatibility with existing stub calls
export async function subscribe(
  filename?: string,
  events?: string[],
  sessionId?: string
): Promise<{ subscribed: boolean; resource_uri: string; files_watched: number }> {
  createWatcher();

  const sub: WatchSubscription = {
    id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    filename,
    events: events ?? ["change"],
    sessionId: sessionId ?? "unknown",
  };

  addSubscription(sub);

  return {
    subscribed: true,
    resource_uri: filename ? `context://${filename}` : "context://*",
    files_watched: subscriptions.size,
  };
}

export async function unsubscribe(subscriptionId: string): Promise<boolean> {
  removeSubscription(subscriptionId);
  return true;
}

export async function cleanupSession(sessionId: string): Promise<void> {
  clearSessionSubscriptions(sessionId);
}
