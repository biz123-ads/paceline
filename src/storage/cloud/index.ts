import type { SupabaseClient } from "@supabase/supabase-js";
import { exportBundleSchema, type ExportBundle, type MetricSnapshot } from "@/domain";
import { nowIso } from "@/lib/id";
import type { Storage } from "../types";
import {
  assumptionsFromRow,
  assumptionsToRow,
  goalFromRow,
  goalToRow,
  projectFromRow,
  projectToRow,
  snapshotFromRow,
  snapshotToRow,
} from "./rows";

type Result<T> = { data: T; error: { message: string } | null };

/** Throws the PostgREST error, if any, and returns the data. */
function check<T>({ data, error }: Result<T>): T {
  if (error) throw new Error(error.message);
  return data;
}

/** Same, for a select of many rows. */
function rows<T>(result: Result<T[] | null>): T[] {
  return check(result) ?? [];
}

/**
 * Storage on the signed-in user's Postgres rows (Supabase). The browser talks
 * to the database directly; Row Level Security keeps every user to their own
 * rows, so there is no API of ours in between.
 */
export function createCloudStorage(db: SupabaseClient): Storage {
  const listeners = new Set<() => void>();

  async function write<T>(run: () => Promise<T>): Promise<T> {
    const result = await run();
    for (const listener of listeners) listener();
    return result;
  }

  /** Same month already stored: overwrite it but keep its id. */
  async function upsertSnapshot(snapshot: MetricSnapshot) {
    const existing = check(
      await db
        .from("snapshots")
        .select("id, created_at")
        .eq("project_id", snapshot.projectId)
        .eq("period", snapshot.period)
        .maybeSingle(),
    );
    const row = snapshotToRow(
      existing ? { ...snapshot, id: existing.id, createdAt: new Date(existing.created_at).toISOString() } : snapshot,
    );
    check(await db.from("snapshots").upsert(row, { onConflict: "id" }));
  }

  const storage: Storage = {
    projects: {
      list: async () =>
        rows(await db.from("projects").select("*").order("created_at")).map(projectFromRow),
      get: async (id) => {
        const row = check(await db.from("projects").select("*").eq("id", id).maybeSingle());
        return row ? projectFromRow(row) : undefined;
      },
      save: (project) =>
        write(async () => void check(await db.from("projects").upsert(projectToRow(project)))),
      // Snapshots, goal and levers go with it (on delete cascade).
      remove: (id) => write(async () => void check(await db.from("projects").delete().eq("id", id))),
    },

    snapshots: {
      listByProject: async (projectId) =>
        rows(
          await db.from("snapshots").select("*").eq("project_id", projectId).order("period"),
        ).map(snapshotFromRow),
      listAll: async () =>
        rows(await db.from("snapshots").select("*").order("period")).map(snapshotFromRow),
      get: async (projectId, period) => {
        const row = check(
          await db
            .from("snapshots")
            .select("*")
            .eq("project_id", projectId)
            .eq("period", period)
            .maybeSingle(),
        );
        return row ? snapshotFromRow(row) : undefined;
      },
      upsert: (snapshot) => write(() => upsertSnapshot(snapshot)),
      remove: (id) => write(async () => void check(await db.from("snapshots").delete().eq("id", id))),
    },

    goals: {
      getByProject: async (projectId) => {
        const row = check(
          await db.from("goals").select("*").eq("project_id", projectId).maybeSingle(),
        );
        return row ? goalFromRow(row) : undefined;
      },
      listAll: async () => rows(await db.from("goals").select("*")).map(goalFromRow),
      // One goal per project: project_id is unique, so this replaces it.
      save: (goal) =>
        write(async () =>
          void check(await db.from("goals").upsert(goalToRow(goal), { onConflict: "project_id" })),
        ),
      removeByProject: (projectId) =>
        write(async () => void check(await db.from("goals").delete().eq("project_id", projectId))),
    },

    assumptions: {
      get: async (projectId) => {
        const row = check(
          await db.from("assumptions").select("*").eq("project_id", projectId).maybeSingle(),
        );
        return row ? assumptionsFromRow(row) : undefined;
      },
      save: (assumptions) =>
        write(async () => void check(await db.from("assumptions").upsert(assumptionsToRow(assumptions)))),
    },

    exportAll: async (): Promise<ExportBundle> => {
      const [projects, snapshots, goals, assumptions] = await Promise.all([
        db.from("projects").select("*").order("created_at"),
        db.from("snapshots").select("*").order("period"),
        db.from("goals").select("*"),
        db.from("assumptions").select("*"),
      ]);
      return {
        version: 1,
        exportedAt: nowIso(),
        // Backups carry no owner: they can be restored into any account.
        projects: rows(projects).map((r) => ({ ...projectFromRow(r), userId: null })),
        snapshots: rows(snapshots).map(snapshotFromRow),
        goals: rows(goals).map(goalFromRow),
        assumptions: rows(assumptions).map(assumptionsFromRow),
      };
    },

    importAll: (raw) =>
      write(async () => {
        const bundle = exportBundleSchema.parse(raw);
        // Parents first, so the children's ownership checks pass.
        if (bundle.projects.length) {
          check(await db.from("projects").upsert(bundle.projects.map(projectToRow)));
        }
        if (bundle.assumptions.length) {
          check(await db.from("assumptions").upsert(bundle.assumptions.map(assumptionsToRow)));
        }
        if (bundle.goals.length) {
          check(
            await db.from("goals").upsert(bundle.goals.map(goalToRow), { onConflict: "project_id" }),
          );
        }
        if (bundle.snapshots.length) {
          // (project, month) is the natural key: merge on it, like the local store.
          check(
            await db
              .from("snapshots")
              .upsert(bundle.snapshots.map(snapshotToRow), { onConflict: "project_id,period" }),
          );
        }
      }),

    // Row Level Security limits this to the user's own projects.
    clear: () => write(async () => void check(await db.from("projects").delete().not("id", "is", null))),

    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return storage;
}
