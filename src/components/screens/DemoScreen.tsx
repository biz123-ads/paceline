"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useStorageMode } from "@/components/data/hooks";
import { Skeleton } from "@/components/ui";
import { SAMPLE_PROJECT_NAME, sampleProjectBundle } from "@/lib/sample-project";
import { getStorage } from "@/storage";

/** /demo: opens the sample project, adding it first if it isn't there. */
export function DemoScreen() {
  const router = useRouter();
  const mode = useStorageMode();
  const started = useRef(false);

  useEffect(() => {
    if (mode === "pending" || started.current) return;
    started.current = true;
    void (async () => {
      const storage = getStorage();
      const existing = (await storage.projects.list()).find((p) => p.name === SAMPLE_PROJECT_NAME);
      let id = existing?.id;
      if (!id) {
        const bundle = sampleProjectBundle();
        await storage.importAll(bundle);
        id = bundle.projects[0].id;
      }
      router.replace(`/projects/${id}`);
    })();
  }, [mode, router]);

  return (
    <div className="space-y-4" aria-busy>
      <p className="text-sm text-muted">Opening the demo project…</p>
      <Skeleton className="h-80" />
    </div>
  );
}
