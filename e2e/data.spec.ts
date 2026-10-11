import { expect, test } from "@playwright/test";
import { createProject, freezeClock, loadSampleProject, projectTab } from "./helpers";

test.beforeEach(async ({ page }) => freezeClock(page));

test("imports months from a European CSV", async ({ page }) => {
  await createProject(page, "From a spreadsheet");
  await projectTab(page, "Data").click();
  await page.getByRole("button", { name: /Import a spreadsheet/ }).click();
  await page.getByLabel("CSV file").setInputFiles({
    name: "export.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("mese;mrr;clienti;spese\n08/2026;1.100,00;55;900\n09/2026;1.200,50;60;\nottobre;x;1;\n"),
  });
  await expect(page.getByText("“ottobre” is not a month we can read.")).toBeVisible();
  await page.getByRole("button", { name: "Import 2 months" }).click();
  await expect(page.getByText("Imported 2 months; skipped 1 with errors.")).toBeVisible();
  await expect(page.getByLabel("Monthly revenue, Sep 2026")).toHaveValue("1200.50");
  await expect(page.getByRole("img", { name: "Imported from CSV" })).toHaveCount(2);
});

test("the Stripe importer explains what it needs and rejects a bad key", async ({ page }) => {
  await createProject(page, "On Stripe");
  await projectTab(page, "Data").click();
  await page.getByRole("button", { name: /Import from Stripe/ }).click();
  await expect(page.getByText(/Give it Read access to Subscriptions/)).toBeVisible();
  await page.getByLabel("Restricted key").fill("pk_test_not_a_secret_key");
  await page.getByRole("button", { name: "Read my subscriptions" }).click();
  await expect(page.getByText(/doesn't look like a Stripe key/)).toBeVisible();
});

test("sample project: explore, then delete it", async ({ page }) => {
  await loadSampleProject(page);
  await expect(page.getByText(/behind the plan|ahead of the plan/)).toBeVisible();

  await projectTab(page, "Settings").click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete project" }).click();
  await expect(page).toHaveURL("/projects");
  await expect(page.getByText("Where is your project heading?")).toBeVisible();
});

test("a backup restores into an empty browser", async ({ page, browser }) => {
  await loadSampleProject(page);
  await page.goto("/settings");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export JSON" }).click(),
  ]);
  const file = await download.path();

  // A fresh context has its own, empty IndexedDB.
  const other = await browser.newContext();
  const fresh = await other.newPage();
  await fresh.goto("/settings");
  await fresh.getByLabel("Backup file").setInputFiles(file);
  await expect(fresh.getByText(/^Imported /)).toBeVisible();
  await fresh.goto("/projects");
  await expect(fresh.getByRole("link", { name: /Invoicely \(sample\)/ }).first()).toBeVisible();
  await other.close();
});

test("no page scrolls sideways", async ({ page }) => {
  await loadSampleProject(page);
  const width = page.viewportSize()!.width;
  const check = async (where: string) => {
    await page.waitForLoadState("networkidle");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth, `${where} is wider than the screen`).toBeLessThanOrEqual(width);
  };
  for (const tab of ["Overview", "Data", "Settings"]) {
    await projectTab(page, tab).click();
    await expect(projectTab(page, tab)).toHaveAttribute("aria-current", "page");
    await check(tab);
  }
  // The sample has costs, so the Data tab already shows every column.
  await projectTab(page, "Data").click();
  await expect(page.getByRole("button", { name: "Fewer columns" })).toBeVisible();
  await check("Data with every column");
  await page.goto("/projects/new");
  await check("setup");
  await page.goto("/");
  await check("landing");
});
