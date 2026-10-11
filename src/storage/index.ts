import { getAuthState, subscribeAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase/browser";
import type { Storage } from "./types";
import { createCloudStorage } from "./cloud";
import { createLocalStorage } from "./local";

export type * from "./types";

/**
 * Where data lives right now:
 * - "local": this browser (IndexedDB), when signed out or accounts are off;
 * - "cloud:<user id>": the signed-in user's rows on Supabase;
 * - "pending": the saved session is still being read; show nothing yet.
 */
export type StorageMode = "pending" | "local" | `cloud:${string}`;

let local: Storage | undefined;
let cloud: { userId: string; storage: Storage } | undefined;

export function getStorageMode(): StorageMode {
  if (typeof window === "undefined") return "pending";
  const auth = getAuthState();
  if (auth.status === "loading") return "pending";
  return auth.status === "signed-in" ? `cloud:${auth.user.id}` : "local";
}

export function subscribeStorageMode(listener: () => void): () => void {
  return subscribeAuth(listener);
}

/** The data in this browser, whatever the account state (to move it). */
export function getLocalStorage(): Storage {
  local ??= createLocalStorage();
  return local;
}

/**
 * The app's storage for the current mode. Call it from client code
 * (effects, event handlers) once the mode is known, never while rendering on
 * the server.
 */
export function getStorage(): Storage {
  if (typeof window === "undefined") {
    throw new Error("getStorage() can only be used in the browser.");
  }
  const auth = getAuthState();
  if (auth.status === "signed-in") {
    if (cloud?.userId !== auth.user.id) {
      cloud = { userId: auth.user.id, storage: createCloudStorage(getSupabase()!) };
    }
    return cloud.storage;
  }
  return getLocalStorage();
}
