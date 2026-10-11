import type {
  Assumptions,
  ExportBundle,
  Goal,
  MetricSnapshot,
  Project,
} from "@/domain";
import type { Period } from "@/lib/period";

/**
 * The only way the app reads and writes data. v1 implements it on IndexedDB
 * (src/storage/local); an account-backed server implementation can replace it
 * later without touching the UI or the plan engine.
 */
export interface ProjectRepository {
  list(): Promise<Project[]>;
  get(id: string): Promise<Project | undefined>;
  /** Insert or update. */
  save(project: Project): Promise<void>;
  /** Deletes the project and everything that belongs to it. */
  remove(id: string): Promise<void>;
}

export interface SnapshotRepository {
  /** Oldest month first. */
  listByProject(projectId: string): Promise<MetricSnapshot[]>;
  /** Every snapshot of every project, oldest month first. */
  listAll(): Promise<MetricSnapshot[]>;
  get(projectId: string, period: Period): Promise<MetricSnapshot | undefined>;
  /** Insert or update; (projectId, period) is the natural key. */
  upsert(snapshot: MetricSnapshot): Promise<void>;
  remove(id: string): Promise<void>;
}

/** One goal per project in the MVP. */
export interface GoalRepository {
  getByProject(projectId: string): Promise<Goal | undefined>;
  listAll(): Promise<Goal[]>;
  /** Insert or replace the project's goal. */
  save(goal: Goal): Promise<void>;
  removeByProject(projectId: string): Promise<void>;
}

export interface AssumptionsRepository {
  get(projectId: string): Promise<Assumptions | undefined>;
  save(assumptions: Assumptions): Promise<void>;
}

export interface Storage {
  projects: ProjectRepository;
  snapshots: SnapshotRepository;
  goals: GoalRepository;
  assumptions: AssumptionsRepository;
  /** Whole dataset as a validated JSON-serialisable bundle (backup). */
  exportAll(): Promise<ExportBundle>;
  /** Validates the bundle and merges it in (upsert); never deletes. */
  importAll(bundle: unknown): Promise<void>;
  /** Called after every write, so screens can reload. Returns unsubscribe. */
  subscribe(listener: () => void): () => void;
}
