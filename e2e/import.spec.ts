import { expect, test } from "@playwright/test";
import { freezeClock, loadSampleProject } from "./helpers";

test.beforeEach(async ({ page }) => freezeClock(page));

test("from the Import section, Excel leads to the project's CSV importer", async ({ page }) => {
  await loadSampleProject(page);
  await page.goto("/import");
  await expect(page.getByRole("heading", { name: "Payments and subscriptions" })).toBeVisible();

  await page.getByRole("link", { name: /Microsoft Excel/ }).click();
  await expect(page).toHaveURL("/import/excel");
  await expect(page.getByText("File → Save As (Save a Copy on Windows) → CSV UTF-8")).toBeVisible();
  await expect(page.getByLabel("Into project")).toHaveValue(/.+/);

  await page.getByRole("link", { name: "Open the importer" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/data#import$/);
  await expect(page.getByRole("button", { name: "Choose a CSV file" })).toBeVisible();
});

test("without a project, a CSV source asks to create one first", async ({ page }) => {
  await page.goto("/import/csv");
  await expect(page.getByRole("link", { name: "Create a project" })).toBeVisible();
});

test("a source that is not connected yet cannot be connected", async ({ page }) => {
  await page.goto("/import/stripe");
  await expect(page.getByRole("heading", { name: "Stripe", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Stripe" })).toBeDisabled();
  await expect(page.getByRole("listitem").filter({ hasText: "Costs" })).toContainText(
    "Not included",
  );
});

test("an unknown source is not found", async ({ page }) => {
  await page.goto("/import/nope");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});
