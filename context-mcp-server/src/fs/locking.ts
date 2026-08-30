/**
 * Optimistic locking via version checks in frontmatter.
 */

export class VersionMismatchError extends Error {
  public expected: number;
  public got: number;

  constructor(expected: number, got: number) {
    super(`VERSION_MISMATCH: Expected version ${expected}, got ${got}. Re-read the file and retry.`);
    this.name = "VersionMismatchError";
    this.expected = expected;
    this.got = got;
  }
}

/**
 * Check that the current version matches the expected version.
 * Throws VersionMismatchError if they don't match.
 */
export function checkVersion(currentVersion: number, expectedVersion: number): void {
  if (expectedVersion !== undefined && expectedVersion !== null && currentVersion !== expectedVersion) {
    throw new VersionMismatchError(expectedVersion, currentVersion);
  }
}
