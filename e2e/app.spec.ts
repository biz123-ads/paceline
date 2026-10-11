import { expect, test } from "@playwright/test";
import { freezeClock, loadSampleProject, projectTab } from "./helpers";

test.beforeEach(async ({ page }) => freezeClock(page));

test("no console errors across the app", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => msg.type() === "error" && errors.push(msg.text()));
  page.on("pageerror", (err) => errors.push(err.message));

  await loadSampleProject(page);
  for (const tab of ["Data", "Settings", "Overview"]) {
    await projectTab(page, tab).click();
    await expect(projectTab(page, tab)).toHaveAttribute("aria-current", "page");
  }
  await page.getByRole("button", { name: "Add month" }).click();
  await expect(page.getByRole("dialog", { name: "Add a month" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/settings");
  await page.goto("/projects/new");
  await page.reload();
  expect(errors).toEqual([]);
});

test("the light theme sticks across reloads, applied before the page paints", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("radio", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  // Record data-theme the moment <body> is created, before anything paints.
  await page.addInitScript(() => {
    new MutationObserver((_, observer) => {
      if (!document.body) return;
      (window as unknown as { themeAtBody: string | null }).themeAtBody =
        document.documentElement.getAttribute("data-theme");
      observer.disconnect();
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto("/projects");
  const themeAtParse = await page.evaluate(
    () => (window as unknown as { themeAtBody: string | null }).themeAtBody,
  );
  expect(themeAtParse).toBe("light");
  await expect(page.getByRole("radio", { name: "Light" })).toHaveCount(0);
  await page.goto("/settings");
  await expect(page.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "true");
});

test("a term explains itself on focus", async ({ page }) => {
  await loadSampleProject(page);
  const hint = page.getByRole("button", { name: "What is churn?" }).first();
  await hint.focus();
  await expect(page.getByRole("tooltip").filter({ hasText: "cancel in a month" }).first()).toBeVisible();
});

test("the landing page opens the demo, once", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("See what it takes");
  await page.getByRole("link", { name: "Try the demo" }).first().click();
  await expect(page.getByRole("heading", { name: "Invoicely (sample)" })).toBeVisible();
  const first = page.url();

  // A second visit reopens the same project instead of adding a copy.
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Invoicely (sample)" })).toBeVisible();
  expect(page.url()).toBe(first);
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "Invoicely (sample)", level: 2 })).toHaveCount(1);
});

test("without accounts set up, sign-in explains where data lives", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Accounts are not set up on this copy of the app")).toBeVisible();
  const status = await (await page.request.get("/api/status")).json();
  expect(status).toEqual({ accounts: false, assistant: false, creditSales: false });
});
