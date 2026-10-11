/**
 * IDs are generated on the client (UUID v4) so data created locally can be
 * uploaded to a server later without ID conflicts.
 */
export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
