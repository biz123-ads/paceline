import { expect, test } from "@playwright/test";
import { createProject, freezeClock, projectTab } from "./helpers";

test.beforeEach(async ({ page }) => freezeClock(page));

test("create a project, enter three months and plan a goal", async ({ page }) => {
  await createProject(page, "Habit app");

  // The add row suggests last month first, then works backwards.
  const months = [
    ["2026-09", "Sep 2026", "1200", "60", "2026-08"],
    ["2026-08", "Aug 2026", "1.100,00", "55", "2026-07"],
    ["2026-07", "Jul 2026", "1000", "50", "2026-06"],
  ] as const;
  for (const [period, label, mrr, customers, next] of months) {
    await expect(page.getByLabel("Month to add")).toHaveValue(period);
    await page.getByLabel(`MRR, ${label}`).fill(mrr);
    await page.getByLabel(`Paying customers, ${label}`).fill(customers);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByLabel("Month to add")).toHaveValue(next);
  }
  await expect(page.getByLabel("MRR, Aug 2026")).toHaveValue("1100");

  await projectTab(page, "Overview").click();
  await expect(page.getByText("MRR · Sep 2026")).toBeVisible();
  await expect(page.getByText("€1,200").first()).toBeVisible();

  await projectTab(page, "Plan").click();
  await page.getByLabel("Target MRR").fill("5000");
  await page.getByRole("button", { name: "Set goal" }).click();
  await expect(page.getByRole("button", { name: "Change" })).toBeVisible();
  await expect(page.getByText("What it takes · 12 months left")).toBeVisible();

  // 5,000 / 20 per customer
  const needed = page.getByText("Paying customers needed").locator("..");
  await expect(needed).toContainText("250");
  await expect(needed).toContainText("You have 60");

  // Moving a lever marks it as the user's own value, and it can be undone.
  const churn = page.getByRole("textbox", { name: "Churn / month" });
  await churn.fill("2");
  await churn.press("Enter");
  await expect(page.getByText("your value")).toBeVisible();
  await expect(page.getByText(/^With your levers,/)).toBeVisible();
  await page.getByRole("button", { name: /^back to/ }).click();
  await expect(page.getByText("your value")).toHaveCount(0);
  await expect(page.getByText(/^At your current pace,/)).toBeVisible();
});

test("editing a cell saves it without losing the next one", async ({ page }) => {
  await createProject(page, "Quick edits");
  await page.getByLabel("MRR, Sep 2026").fill("500");
  await page.getByLabel("Paying customers, Sep 2026").fill("10");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByLabel("Month to add")).toHaveValue("2026-08");

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
