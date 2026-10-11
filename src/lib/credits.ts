"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase/browser";

/**
 * The signed-in user's credit balance, shared by every component that shows
 * it. `setCreditBalance` updates it after a question (the server reports
 * the new balance), `refreshCredits` reads it again from the ledger.
 */
let balance: number | null = null;
/** Whose balance was last read, so each user is read once per page load. */
let loadedFor: string | null = null;
const listeners = new Set<() => void>();

export function setCreditBalance(next: number | null) {
  balance = next;
  for (const listener of listeners) listener();
}

export async function refreshCredits() {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data, error } = await supabase.rpc("credit_balance");
  if (!error) setCreditBalance(data as number);
}

export function useCredits(): number | null {
  const auth = useAuth();
  const signedIn = auth.status === "signed-in";
  const value = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => balance,
    () => null,
  );
  const userId = signedIn ? auth.user.id : null;
  useEffect(() => {
    if (!userId || loadedFor === userId) return;
    loadedFor = userId;
    void refreshCredits();
  }, [userId]);
  return signedIn ? value : null;
}
