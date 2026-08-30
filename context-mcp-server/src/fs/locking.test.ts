import { describe, it, expect } from "vitest";
import { checkVersion, VersionMismatchError } from "./locking.js";

describe("VersionMismatchError", () => {
  it("creates error with correct message", () => {
    const err = new VersionMismatchError(3, 5);
    expect(err.message).toContain("VERSION_MISMATCH");
    expect(err.message).toContain("Expected version 3");
    expect(err.message).toContain("got 5");
  });

  it("stores expected and got values", () => {
    const err = new VersionMismatchError(3, 5);
    expect(err.expected).toBe(3);
    expect(err.got).toBe(5);
  });

  it("has correct name", () => {
    const err = new VersionMismatchError(1, 2);
    expect(err.name).toBe("VersionMismatchError");
  });
});

describe("checkVersion", () => {
  it("passes when versions match", () => {
    expect(() => checkVersion(3, 3)).not.toThrow();
  });

  it("throws VersionMismatchError when versions differ", () => {
    expect(() => checkVersion(3, 5)).toThrow(VersionMismatchError);
  });

  it("passes when expectedVersion is undefined", () => {
    expect(() => checkVersion(3, undefined as any)).not.toThrow();
  });

  it("passes when expectedVersion is null", () => {
    expect(() => checkVersion(3, null as any)).not.toThrow();
  });

  it("throws when current version is 0 and expected is 1", () => {
    expect(() => checkVersion(0, 1)).toThrow(VersionMismatchError);
  });
});
