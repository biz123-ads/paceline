import { expect, type Page } from "@playwright/test";

/** Every test starts on 11 Oct 2026 so suggested months are predictable. */
export async function freezeClock(page: Page) {
  await page.clock.setFixedTime(new Date("2026-10-11T10:00:00"));
}

export async function loadSampleProject(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample data" }).click();
  await expect(page.getByRole("heading", { name: "Invoicely (sample)" })).toBeVisible();
}

export async function createProject(page: Page, name: string) {
  await page.goto("/projects/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/data#add$/);
}

export function projectTab(page: Page, name: string) {
  return page.getByRole("navigation", { name: "Project" }).getByRole("link", { name });
}
