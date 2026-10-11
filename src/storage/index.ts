import type { Storage } from "./types";
import { createLocalStorage } from "./local";

export type * from "./types";

let instance: Storage | undefined;

/**
 * The app's storage. Browser-only in v1 (IndexedDB), so call it from client
 * code (effects, event handlers), never while rendering on the server.
 */
export function getStorage(): Storage {
  if (typeof window === "undefined") {
    throw new Error("getStorage() can only be used in the browser (v1 is local-only).");
  }
  instance ??= createLocalStorage();
  return instance;
}
