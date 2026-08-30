import { describe, it, expect, beforeEach } from "vitest";
import { SessionRegistry } from "./session-registry.js";

describe("SessionRegistry", () => {
  let registry: SessionRegistry;

  beforeEach(() => {
    registry = new SessionRegistry();
  });

  describe("createSession", () => {
    it("creates a session with the given tool name", () => {
      const session = registry.createSession("claude");
      expect(session.toolName).toBe("claude");
      expect(session.sessionId).toBeTruthy();
      expect(session.filesAccessed.size).toBe(0);
      expect(session.toolsCalled).toEqual([]);
    });

    it("generates unique session IDs", () => {
      const s1 = registry.createSession("tool-a");
      const s2 = registry.createSession("tool-b");
      expect(s1.sessionId).not.toBe(s2.sessionId);
    });

    it("sets startedAt and lastActiveAt", () => {
      const session = registry.createSession("test");
      expect(session.startedAt).toBeInstanceOf(Date);
      expect(session.lastActiveAt).toBeInstanceOf(Date);
    });
  });

  describe("getSession", () => {
    it("returns a session by ID", () => {
      const created = registry.createSession("claude");
      const found = registry.getSession(created.sessionId);
      expect(found).toBeDefined();
      expect(found!.sessionId).toBe(created.sessionId);
    });

    it("returns undefined for unknown session", () => {
      const found = registry.getSession("non-existent");
      expect(found).toBeUndefined();
    });
  });

  describe("recordFileAccess", () => {
    it("records a file access for a session", () => {
      const session = registry.createSession("test");
      registry.recordFileAccess(session.sessionId, "file-a.md");
      expect(session.filesAccessed.has("file-a.md")).toBe(true);
    });

    it("updates lastActiveAt on file access", () => {
      const session = registry.createSession("test");
      const original = session.lastActiveAt.getTime();
      registry.recordFileAccess(session.sessionId, "file.md");
      expect(session.lastActiveAt.getTime()).toBeGreaterThanOrEqual(original);
    });

    it("does nothing for unknown session", () => {
      expect(() => registry.recordFileAccess("ghost", "file.md")).not.toThrow();
    });
  });

  describe("recordToolCall", () => {
    it("records a tool call for a session", () => {
      const session = registry.createSession("test");
      registry.recordToolCall(session.sessionId, "context_read");
      expect(session.toolsCalled).toContain("context_read");
    });

    it("appends multiple tool calls", () => {
      const session = registry.createSession("test");
      registry.recordToolCall(session.sessionId, "context_read");
      registry.recordToolCall(session.sessionId, "context_write");
      expect(session.toolsCalled).toEqual(["context_read", "context_write"]);
    });

    it("does nothing for unknown session", () => {
      expect(() => registry.recordToolCall("ghost", "context_read")).not.toThrow();
    });
  });

  describe("removeSession", () => {
    it("removes a session from the registry", () => {
      const session = registry.createSession("test");
      registry.removeSession(session.sessionId);
      expect(registry.getSession(session.sessionId)).toBeUndefined();
    });

    it("does nothing for unknown session", () => {
      expect(() => registry.removeSession("ghost")).not.toThrow();
    });
  });

  describe("getAllSessions", () => {
    it("returns empty array for no sessions", () => {
      expect(registry.getAllSessions()).toEqual([]);
    });

    it("returns all registered sessions", () => {
      registry.createSession("tool-a");
      registry.createSession("tool-b");
      registry.createSession("tool-c");
      expect(registry.getAllSessions()).toHaveLength(3);
    });
  });

  describe("cleanupStale", () => {
    it("removes sessions idle longer than maxAgeMs", () => {
      const session = registry.createSession("test");
      // Manually set lastActiveAt far in the past
      session.lastActiveAt = new Date(Date.now() - 100_000);
      const removed = registry.cleanupStale(50_000);
      expect(removed).toBe(1);
      expect(registry.getSession(session.sessionId)).toBeUndefined();
    });

    it("keeps sessions active within maxAgeMs", () => {
      registry.createSession("test");
      const removed = registry.cleanupStale(100_000);
      expect(removed).toBe(0);
      expect(registry.getAllSessions()).toHaveLength(1);
    });

    it("uses default stale time when maxAgeMs is not provided", () => {
      const session = registry.createSession("test");
      session.lastActiveAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      const removed = registry.cleanupStale();
      expect(removed).toBe(1);
    });

    it("removes 0 for maxAgeMs=0 with active session", () => {
      registry.createSession("test");
      const removed = registry.cleanupStale(0);
      // Should not remove sessions with lastActiveAt = now
      expect(removed).toBe(0);
    });
  });
});
