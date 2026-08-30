import { v4 as uuidv4 } from "uuid";

export interface SessionInfo {
  sessionId: string;
  toolName: string;
  startedAt: Date;
  filesAccessed: Set<string>;
  toolsCalled: string[];
  lastActiveAt: Date;
}

/**
 * Registry for tracking connected AI sessions.
 * Used for session grouping, file access patterns, and stale session cleanup.
 */
export class SessionRegistry {
  private sessions: Map<string, SessionInfo> = new Map();
  private static readonly DEFAULT_STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Create a new session.
   */
  createSession(toolName: string): SessionInfo {
    const session: SessionInfo = {
      sessionId: uuidv4(),
      toolName,
      startedAt: new Date(),
      filesAccessed: new Set(),
      toolsCalled: [],
      lastActiveAt: new Date(),
    };
    this.sessions.set(session.sessionId, session);
    return session;
  }

  /**
   * Get a session by ID.
   */
  getSession(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Record that a session accessed a file.
   */
  recordFileAccess(sessionId: string, filename: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.filesAccessed.add(filename);
      session.lastActiveAt = new Date();
    }
  }

  /**
   * Record that a session called a tool.
   */
  recordToolCall(sessionId: string, toolName: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.toolsCalled.push(toolName);
      session.lastActiveAt = new Date();
    }
  }

  /**
   * Remove a session from the registry.
   */
  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Get all registered sessions.
   */
  getAllSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Clean up stale sessions that haven't been active for maxAgeMs.
   * Returns the number of sessions removed.
   */
  cleanupStale(maxAgeMs?: number): number {
    const maxAge = maxAgeMs ?? SessionRegistry.DEFAULT_STALE_MS;
    const now = Date.now();
    let removed = 0;

    for (const [id, session] of this.sessions) {
      const idleMs = now - session.lastActiveAt.getTime();
      if (idleMs > maxAge) {
        this.sessions.delete(id);
        removed++;
      }
    }

    return removed;
  }
}

/** Singleton instance */
export const sessionRegistry = new SessionRegistry();
