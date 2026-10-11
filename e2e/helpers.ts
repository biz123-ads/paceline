import { expect, type Page } from "@playwright/test";

/** Every test starts on 11 Oct 2026 so suggested months are predictable. */
export async function freezeClock(page: Page) {
  await page.clock.setFixedTime(new Date("2026-10-11T10:00:00"));
}

export async function loadSampleProject(page: Page) {
  await page.goto("/projects");
  await page.getByRole("button", { name: "Explore with sample data" }).click();
  await expect(page.getByRole("heading", { name: "Invoicely (sample)" })).toBeVisible();
}

/** Creates a project through the setup, skipping the numbers and the goal. */
export async function createProject(page: Page, name: string) {
  await page.goto("/projects/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
}

export function projectTab(page: Page, name: string) {
  return page.getByRole("navigation", { name: "Project" }).getByRole("link", { name });
}

/** Fills the "Add a month" dialog; `another` keeps it open for the next month. */
export async function addMonth(
  page: Page,
  revenue: string,
  customers: string,
  { another = false }: { another?: boolean } = {},
) {
  const dialog = page.getByRole("dialog", { name: "Add a month" });
  if (!(await dialog.isVisible())) {
    await page.getByRole("button", { name: "Add month" }).click();
  }
  await dialog.getByLabel(/^Monthly revenue/).fill(revenue);
  await dialog.getByLabel(/^Paying customers/).fill(customers);
  await dialog.getByRole("button", { name: another ? "Save and add another" : "Save", exact: true }).click();
}
