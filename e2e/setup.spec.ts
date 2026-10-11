import { expect, test } from "@playwright/test";
import { addMonth, createProject, freezeClock, projectTab } from "./helpers";

test.beforeEach(async ({ page }) => freezeClock(page));

test("guided setup, more months, then a what-if", async ({ page }) => {
  await page.goto("/projects/new");
  await expect(page.getByText("Step 1 of 3")).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill("Habit app");
  await page.getByRole("button", { name: "Next" }).click();

  // Step 2 asks about the last full month.
  await expect(page.getByText("Your numbers for Sep 2026")).toBeVisible();
  await page.getByLabel(/^Monthly revenue/).fill("1200");
  await page.getByLabel(/^Paying customers/).fill("60");
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByLabel("Monthly revenue I want").fill("5000");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/);

  await expect(page.getByText("€1,200").first()).toBeVisible();
  await expect(page.getByText("What it takes · 12 months left")).toBeVisible();

  // The dialog suggests the months before, one after the other.
  await addMonth(page, "1.100,00", "55", { another: true });
  await expect(page.getByText("Saved Aug 2026. Next: Jul 2026.")).toBeVisible();
  await addMonth(page, "1000", "50");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // 5,000 / 20 per customer
  await expect(page.getByText(/250\s+paying customers in total at €20 each/)).toBeVisible();

  // A what-if marks the number as the user's own, and it can be undone.
  const churn = page.getByRole("textbox", { name: "Customers who leave each month" });
  await churn.fill("2");
  await churn.press("Enter");
  await expect(page.getByText("your value")).toBeVisible();
  await expect(page.getByText(/^With your numbers,/)).toBeVisible();
  await page.getByRole("button", { name: /^back to/ }).click();
  await expect(page.getByText("your value")).toHaveCount(0);
  await expect(page.getByText(/^At your current pace,/)).toBeVisible();

  await projectTab(page, "Data").click();
  await expect(page.getByLabel("Monthly revenue, Aug 2026")).toHaveValue("1100");
});

test("no customers yet: the setup asks for a price", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByLabel("Name", { exact: true }).fill("Side project");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel(/^Monthly revenue/).fill("0");
  await page.getByLabel(/^Paying customers/).fill("0");
  await page.getByLabel("What will you charge a customer each month?").fill("19");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Monthly revenue I want").fill("1900");
  await page.getByRole("button", { name: "Create project" }).click();

  // 1,900 / 19 = 100 customers, all of them new.
  await expect(page.getByText(/100\s+paying customers in total at €19 each/)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Price per customer" })).toHaveValue("19");
});

test("editing a cell saves it without losing the next one", async ({ page }) => {
  await createProject(page, "Quick edits");
  await addMonth(page, "500", "10");
  await projectTab(page, "Data").click();
  await page.getByRole("button", { name: /^More columns/ }).click();

  await page.getByLabel("Paying customers, Sep 2026").fill("12");
  await page.keyboard.press("Tab");
  // Typed while the first save is still being written.
  await page.keyboard.type("3");
  await page.keyboard.press("Tab");
  // Wait for both saves, not just the first one.
  await expect(page.getByText("Saving…")).toHaveCount(0);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect(page.getByLabel("New customers, Sep 2026")).toHaveValue("3");

  await page.reload();
  await expect(page.getByLabel("Paying customers, Sep 2026")).toHaveValue("12");
  await expect(page.getByLabel("New customers, Sep 2026")).toHaveValue("3");
});
