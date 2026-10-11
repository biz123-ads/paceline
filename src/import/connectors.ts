import type { ImportField } from "./csv-import";

/**
 * Every place monthly numbers can come from. Pure data: the Import screens
 * render it, and each connector gets its own page at /import/[id].
 *
 * Status, today:
 * - "available": works now.
 * - "via-csv": export a CSV from the app, then use the CSV import.
 * - "planned": listed so the shape of the section is clear; not wired yet.
 */

export const CONNECTOR_CATEGORIES = [
  {
    id: "files",
    label: "Files and spreadsheets",
    hint: "Wherever you already keep your numbers by hand.",
  },
  {
    id: "payments",
    label: "Payments and subscriptions",
    hint: "MRR and customers straight from what you charge.",
  },
  {
    id: "app-stores",
    label: "App stores",
    hint: "Subscriptions sold inside iOS and Android apps.",
  },
  {
    id: "analytics",
    label: "Revenue analytics",
    hint: "Tools that already compute your MRR.",
  },
  {
    id: "accounting",
    label: "Accounting",
    hint: "Monthly costs, for runway and break-even.",
  },
] as const;

export type ConnectorCategory = (typeof CONNECTOR_CATEGORIES)[number]["id"];

export type ConnectorStatus = "available" | "via-csv" | "planned";

/** How a direct connection signs in, once it exists. */
export type ConnectMethod = "file" | "oauth" | "api-key";

/** Monthly values a connector can fill in. */
export type ConnectorMetric = Exclude<ImportField, "period">;

/** The shape every catalog entry satisfies. */
interface ConnectorSpec {
  /** URL slug. */
  id: string;
  name: string;
  category: ConnectorCategory;
  status: ConnectorStatus;
  /** One line for the card. */
  summary: string;
  metrics: readonly ConnectorMetric[];
  /** The direct connection; null when a CSV export is the only way. */
  direct: ConnectMethod | null;
  /** Who the direct connection signs in with, when it is not `name`. */
  account?: string;
  /** Menu path to a CSV export, for "via-csv" connectors. */
  csvExport?: string;
}

const ALL_METRICS = [
  "mrr",
  "payingCustomers",
  "newCustomers",
  "churnedCustomers",
  "costs",
] as const satisfies readonly ConnectorMetric[];

const SUBSCRIPTION_METRICS = [
  "mrr",
  "payingCustomers",
  "newCustomers",
  "churnedCustomers",
] as const satisfies readonly ConnectorMetric[];

export const CONNECTORS = [
  // Files and spreadsheets
  {
    id: "csv",
    name: "CSV file",
    category: "files",
    status: "available",
    summary: "One row per month, from any spreadsheet or export.",
    metrics: ALL_METRICS,
    direct: "file",
  },
  {
    id: "excel",
    name: "Microsoft Excel",
    category: "files",
    status: "via-csv",
    summary: "Save the sheet as CSV and import it.",
    metrics: ALL_METRICS,
    direct: "file",
    csvExport: "File → Save As (Save a Copy on Windows) → CSV UTF-8",
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    category: "files",
    status: "via-csv",
    summary: "Download the sheet as CSV and import it.",
    metrics: ALL_METRICS,
    direct: "oauth",
    account: "Google",
    csvExport: "File → Download → Comma-separated values (.csv)",
  },
  {
    id: "numbers",
    name: "Apple Numbers",
    category: "files",
    status: "via-csv",
    summary: "Export the table to CSV and import it.",
    metrics: ALL_METRICS,
    direct: null,
    csvExport: "File → Export To → CSV",
  },
  {
    id: "airtable",
    name: "Airtable",
    category: "files",
    status: "via-csv",
    summary: "Download a view as CSV and import it.",
    metrics: ALL_METRICS,
    direct: "oauth",
    csvExport: "View menu (•••) → Download CSV",
  },
  {
    id: "notion",
    name: "Notion",
    category: "files",
    status: "via-csv",
    summary: "Export a database as CSV and import it.",
    metrics: ALL_METRICS,
    direct: "oauth",
    csvExport: "Database menu (•••) → Export → Markdown & CSV, then unzip",
  },

  // Payments and subscriptions
  {
    id: "stripe",
    name: "Stripe",
    category: "payments",
    status: "planned",
    summary: "MRR, customers and churn from your subscriptions.",
    metrics: SUBSCRIPTION_METRICS,
    direct: "api-key",
  },
  {
    id: "paddle",
    name: "Paddle",
    category: "payments",
    status: "planned",
    summary: "Subscription revenue and customers, taxes handled.",
    metrics: SUBSCRIPTION_METRICS,
    direct: "api-key",
  },
  {
    id: "lemon-squeezy",
    name: "Lemon Squeezy",
    category: "payments",
    status: "planned",
    summary: "Subscriptions and customers from your store.",
    metrics: SUBSCRIPTION_METRICS,
    direct: "api-key",
  },
  {
    id: "paypal",
    name: "PayPal",
    category: "payments",
    status: "planned",
    summary: "Recurring payments and subscribers.",
    metrics: SUBSCRIPTION_METRICS,
    direct: "oauth",
  },
  {
    id: "gumroad",
    name: "Gumroad",
    category: "payments",
    status: "planned",
    summary: "Memberships and recurring sales.",
    metrics: SUBSCRIPTION_METRICS,
    direct: "oauth",
  },

  // App stores
  {
    id: "app-store",
    name: "App Store Connect",
    category: "app-stores",
    status: "planned",
    summary: "Proceeds and active subscriptions from Apple.",
    metrics: SUBSCRIPTION_METRICS,
    direct: "api-key",
  },
  {
    id: "google-play",
    name: "Google Play Console",
    category: "app-stores",
    status: "planned",
    summary: "Subscription revenue and subscribers on Android.",
    metrics: SUBSCRIPTION_METRICS,
    direct: "api-key",
  },
  {
    id: "revenuecat",
    name: "RevenueCat",
    category: "app-stores",
    status: "planned",
    summary: "Both stores in one place, already as MRR.",
    metrics: SUBSCRIPTION_METRICS,
    direct: "api-key",
  },

  // Revenue analytics
  {
    id: "chartmogul",
    name: "ChartMogul",
    category: "analytics",
    status: "planned",
    summary: "Your MRR history, month by month.",
    metrics: SUBSCRIPTION_METRICS,
    direct: "api-key",
  },
  {
    id: "baremetrics",
    name: "Baremetrics",
    category: "analytics",
    status: "planned",
    summary: "MRR, customers and churn it already tracks.",
    metrics: SUBSCRIPTION_METRICS,
    direct: "api-key",
  },

  // Accounting
  {
    id: "quickbooks",
    name: "QuickBooks",
    category: "accounting",
    status: "planned",
    summary: "Monthly expenses from your books.",
    metrics: ["costs"],
    direct: "oauth",
  },
  {
    id: "xero",
    name: "Xero",
    category: "accounting",
    status: "planned",
    summary: "Monthly expenses from your books.",
    metrics: ["costs"],
    direct: "oauth",
  },
] as const satisfies readonly ConnectorSpec[];

export type ConnectorId = (typeof CONNECTORS)[number]["id"];
export type Connector = ConnectorSpec & { id: ConnectorId };

export function findConnector(id: string): Connector | undefined {
  return CONNECTORS.find((c) => c.id === id);
}

export function connectorsIn(category: ConnectorCategory): Connector[] {
  return CONNECTORS.filter((c) => c.category === category);
}
