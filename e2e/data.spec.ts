import { expect, test } from "@playwright/test";
import { createProject, freezeClock, loadSampleProject, projectTab } from "./helpers";

test.beforeEach(async ({ page }) => freezeClock(page));

test("imports months from a European CSV", async ({ page }) => {
  await createProject(page, "From a spreadsheet");
  await page.getByRole("button", { name: /Import a CSV/ }).click();
  await page.getByLabel("CSV file").setInputFiles({
    name: "export.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("mese;mrr;clienti;spese\n08/2026;1.100,00;55;900\n09/2026;1.200,50;60;\nottobre;x;1;\n"),
  });
  await expect(page.getByText("“ottobre” is not a month we can read.")).toBeVisible();
  await page.getByRole("button", { name: "Import 2 months" }).click();
  await expect(page.getByText("Imported 2 months; skipped 1 with errors.")).toBeVisible();
  await expect(page.getByLabel("MRR, Sep 2026")).toHaveValue("1200.50");
  await expect(page.getByRole("img", { name: "Imported from CSV" })).toHaveCount(2);
});

test("sample project: explore, then delete it", async ({ page }) => {
  await loadSampleProject(page);
  await expect(page.getByText(/behind plan|ahead of plan/)).toBeVisible();

  await projectTab(page, "Details").click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete project" }).click();
  await expect(page).toHaveURL("/");
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
  await fresh.goto("/");
  await expect(fresh.getByRole("link", { name: /Invoicely \(sample\)/ }).first()).toBeVisible();
  await other.close();
});

test("no page scrolls sideways", async ({ page }) => {
  await loadSampleProject(page);
  const width = page.viewportSize()!.width;
  for (const tab of ["Overview", "Plan", "Data", "Details"]) {
    await projectTab(page, tab).click();
    await expect(page.getByRole("navigation", { name: "Project" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth, `${tab} is wider than the screen`).toBeLessThanOrEqual(width);
  }
  for (const path of ["/import", "/import/google-sheets", "/import/app-store"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth, `${path} is wider than the screen`).toBeLessThanOrEqual(width);
  }
});
