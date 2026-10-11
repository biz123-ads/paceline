"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getLocalStorage, getStorage } from "@/storage";
import { Button } from "@/components/ui";
import { CloudIcon } from "@/components/icons";

/**
 * Signed in, with projects still saved in this browser from before: offer to
 * move them into the account (then remove the browser copy, so nothing is
 * shown twice or edited in the wrong place).
 */
export function LocalDataClaim() {
  const auth = useAuth();
  const [count, setCount] = useState(0);
  const [state, setState] = useState<"idle" | "moving" | "done" | "error">("idle");
  const signedIn = auth.status === "signed-in";

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    getLocalStorage()
      .projects.list()
      .then((projects) => !cancelled && setCount(projects.length))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  if (!signedIn || (count === 0 && state !== "done")) return null;

  async function move() {
    setState("moving");
    try {
      const local = getLocalStorage();
      const bundle = await local.exportAll();
      await getStorage().importAll({
        ...bundle,
        projects: bundle.projects.map((p) => ({ ...p, userId: null })),
      });
      await local.clear();
      setCount(0);
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-border-strong bg-surface-2 px-4 py-3 text-sm">
      <CloudIcon className="shrink-0 text-muted" />
      {state === "done" ? (
        <p className="flex-1">Moved to your account. They are now on every device you sign in on.</p>
      ) : (
        <>
          <p className="min-w-0 flex-1">
            {count} {count === 1 ? "project is" : "projects are"} saved only in this browser, from
            before you signed in.
            {state === "error" && (
              <span className="block text-danger">Moving failed. Nothing was deleted; try again.</span>
            )}
          </p>
          <Button size="sm" variant="primary" onClick={move} disabled={state === "moving"}>
            {state === "moving" ? "Moving…" : "Move to my account"}
          </Button>
        </>
      )}
    </div>
  );
}
