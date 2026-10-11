import { exportBundleSchema, type ExportBundle } from "@/domain";
import { nowIso } from "@/lib/id";
import type { Storage } from "../types";
import { LocalDb } from "./db";

export function createLocalStorage(db: LocalDb = new LocalDb()): Storage {
  const listeners = new Set<() => void>();

  /** Runs a write, then tells subscribers the data changed. */
  async function write<T>(run: () => Promise<T>): Promise<T> {
    const result = await run();
    for (const listener of listeners) listener();
    return result;
  }

  const storage: Storage = {
    projects: {
      list: async () => {
        const rows = await db.projects.toArray();
        return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      },
      get: (id) => db.projects.get(id),
      save: (project) => write(async () => void (await db.projects.put(project))),
      remove: (id) =>
        write(() =>
          db.transaction(
            "rw",
            [db.projects, db.snapshots, db.goals, db.assumptions],
            async () => {
              await db.snapshots.where("projectId").equals(id).delete();
              await db.goals.where("projectId").equals(id).delete();
              await db.assumptions.delete(id);
              await db.projects.delete(id);
            },
          ),
        ),
    },

    snapshots: {
      listByProject: async (projectId) => {
        const rows = await db.snapshots
          .where("projectId")
          .equals(projectId)
          .toArray();
        return rows.sort((a, b) => a.period.localeCompare(b.period));
      },
      listAll: async () => {
        const rows = await db.snapshots.toArray();
        return rows.sort((a, b) => a.period.localeCompare(b.period));
      },
      get: (projectId, period) => db.snapshots.get({ projectId, period }),
      upsert: (snapshot) => write(() => upsertSnapshot(snapshot)),
      remove: (id) => write(() => db.snapshots.delete(id)),
    },

    goals: {
      getByProject: (projectId) => db.goals.get({ projectId }),
      listAll: () => db.goals.toArray(),
      save: (goal) =>
        write(() =>
          db.transaction("rw", db.goals, async () => {
            // One goal per project: replace whatever was there.
            await db.goals.where("projectId").equals(goal.projectId).delete();
            await db.goals.put(goal);
          }),
        ),
      removeByProject: (projectId) =>
        write(async () => void (await db.goals.where("projectId").equals(projectId).delete())),
    },

    assumptions: {
      get: (projectId) => db.assumptions.get(projectId),
      save: (assumptions) =>
        write(async () => void (await db.assumptions.put(assumptions))),
    },

    exportAll: async (): Promise<ExportBundle> => ({
      version: 1,
      exportedAt: nowIso(),
      projects: await db.projects.toArray(),
      snapshots: await db.snapshots.toArray(),
      goals: await db.goals.toArray(),
      assumptions: await db.assumptions.toArray(),
    }),

    importAll: (raw) =>
      write(async () => {
        const bundle = exportBundleSchema.parse(raw);
        await db.projects.bulkPut(bundle.projects);
        await db.assumptions.bulkPut(bundle.assumptions);
        for (const goal of bundle.goals) {
          await db.goals.where("projectId").equals(goal.projectId).delete();
          await db.goals.put(goal);
        }
        // Through upsert so (projectId, period) conflicts merge instead of throwing.
        for (const snapshot of bundle.snapshots) {
          await upsertSnapshot(snapshot);
        }
      }),

    clear: () =>
      write(() =>
        db.transaction("rw", [db.projects, db.snapshots, db.goals, db.assumptions], async () => {
          await Promise.all([
            db.projects.clear(),
            db.snapshots.clear(),
            db.goals.clear(),
            db.assumptions.clear(),
          ]);
        }),
      ),

    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  function upsertSnapshot(snapshot: ExportBundle["snapshots"][number]) {
    return db.transaction("rw", db.snapshots, async () => {
      const existing = await db.snapshots.get({
        projectId: snapshot.projectId,
        period: snapshot.period,
      });
      // Same month already stored: overwrite that row, keep its identity.
      await db.snapshots.put(
        existing
          ? { ...snapshot, id: existing.id, createdAt: existing.createdAt }
          : snapshot,
      );
    });
  }

  return storage;
}
