"use client";

import { useSyncExternalStore } from "react";
import { SUPABASE } from "@/config/services";
import { getSupabase } from "@/lib/supabase/browser";

/**
 * Who is signed in, as a tiny external store fed by Supabase's
 * onAuthStateChange. "disabled" means accounts are not set up at all.
 */
export type AuthState =
  | { status: "disabled" }
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; user: { id: string; email: string } };

const INITIAL: AuthState = SUPABASE ? { status: "loading" } : { status: "disabled" };

let state: AuthState = INITIAL;
let started = false;
const listeners = new Set<() => void>();

function set(next: AuthState) {
  const same =
    next.status === state.status &&
    (next.status !== "signed-in" || (state.status === "signed-in" && state.user.id === next.user.id));
  if (same) return;
  state = next;
  for (const listener of listeners) listener();
}

function start() {
  if (started) return;
  started = true;
  const supabase = getSupabase();
  if (!supabase) return;
  // Fires INITIAL_SESSION right away, then on every sign in and out.
  supabase.auth.onAuthStateChange((_event, session) => {
    set(
      session?.user
        ? { status: "signed-in", user: { id: session.user.id, email: session.user.email ?? "" } }
        : { status: "signed-out" },
    );
  });
}

export function getAuthState(): AuthState {
  start();
  return state;
}

export function subscribeAuth(listener: () => void): () => void {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribeAuth, getAuthState, () => INITIAL);
}

export async function signOut() {
  await getSupabase()?.auth.signOut();
}
