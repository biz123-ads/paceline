"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import type { Assumptions, Goal, MetricSnapshot, Project } from "@/domain";
import {
  getStorage,
  getStorageMode,
  subscribeStorageMode,
  type Storage,
  type StorageMode,
} from "@/storage";

/** Local or cloud (and whose), re-rendering when the user signs in or out. */
export function useStorageMode(): StorageMode {
  return useSyncExternalStore(subscribeStorageMode, getStorageMode, () => "pending");
}

export type QueryState<T> =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "ready"; data: T };

/**
 * Runs `load` against storage in the browser and runs it again after every
 * write. `key` identifies the query: change it to reload with new inputs.
 * Signing in or out switches storage and reloads too.
 */
export function useStorageQuery<T>(
  queryKey: string,
  load: (storage: Storage) => Promise<T>,
): QueryState<T> {
  const mode = useStorageMode();
  const key = `${mode}|${queryKey}`;
  const [state, setState] = useState<{ key: string; value: QueryState<T> }>({
    key,
    value: { status: "loading" },
  });

  useEffect(() => {
    if (mode === "pending") return;
    const storage = getStorage();
    let cancelled = false;
    const run = () =>
      load(storage).then(
        (data) => !cancelled && setState({ key, value: { status: "ready", data } }),
        (error: unknown) =>
          !cancelled &&
          setState({
            key,
            value: {
              status: "error",
              error: error instanceof Error ? error : new Error(String(error)),
            },
          }),
      );
    run();
    const unsubscribe = storage.subscribe(run);
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // `load` is re-created every render; `key` captures what it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // A new key shows "loading" right away instead of the previous key's data.
  return state.key === key && mode !== "pending" ? state.value : { status: "loading" };
}

export interface ProjectData {
  project: Project;
  snapshots: MetricSnapshot[];
  goal: Goal | undefined;
  assumptions: Assumptions | undefined;
}

/** The project in the URL (/projects/[id]/…) with everything it owns. */
export function useProjectData(): QueryState<ProjectData | null> & { id: string } {
  const { id } = useParams<{ id: string }>();
  const state = useStorageQuery(`project:${id}`, async (storage) => {
    const project = await storage.projects.get(id);
    if (!project) return null;
    const [snapshots, goal, assumptions] = await Promise.all([
      storage.snapshots.listByProject(id),
      storage.goals.getByProject(id),
      storage.assumptions.get(id),
    ]);
    return { project, snapshots, goal, assumptions };
  });
  return { ...state, id };
}

export interface ProjectSummary {
  project: Project;
  snapshots: MetricSnapshot[];
  goal: Goal | undefined;
}

/** Every project with its months and goal, for the list and the sidebar. */
export function useProjectSummaries(): QueryState<ProjectSummary[]> {
  return useStorageQuery("projects", async (storage) => {
    const [projects, snapshots, goals] = await Promise.all([
      storage.projects.list(),
      storage.snapshots.listAll(),
      storage.goals.listAll(),
    ]);
    return projects.map((project) => ({
      project,
      snapshots: snapshots.filter((s) => s.projectId === project.id),
      goal: goals.find((g) => g.projectId === project.id),
    }));
  });
}
