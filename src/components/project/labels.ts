import type { ProjectKind, ProjectStage, SnapshotSource } from "@/domain";

export const KIND_LABELS: Record<ProjectKind, string> = {
  saas: "SaaS",
  app: "App",
  other: "Other",
};

export const STAGE_LABELS: Record<ProjectStage, string> = {
  idea: "Idea",
  building: "Building",
  launched: "Launched",
  growing: "Growing",
};

export const SOURCE_LABELS: Record<SnapshotSource, string> = {
  manual: "Entered by hand",
  csv: "Imported from CSV",
  stripe: "Synced from Stripe",
  revenuecat: "Synced from RevenueCat",
};

export const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD", "AUD", "SEK", "PLN"] as const;
