import { test, type Page } from "@playwright/test";
import { freezeClock, loadSampleProject, projectTab } from "./helpers";

/**
 * Not a test: refreshes the README images. Run with
 *   SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts --project=desktop
 */
test.skip(!process.env.SCREENSHOTS, "Only when refreshing the README images.");
test.use({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 2 });

const shot = (page: Page, name: string, fullPage = false) =>
  page.screenshot({ path: `docs/screenshots/${name}.png`, fullPage, animations: "disabled" });

test("README screenshots", async ({ page, browser }) => {
  await freezeClock(page);
  await page.goto("/");
  await shot(page, "landing");

  await loadSampleProject(page);
  await page.waitForLoadState("networkidle");
  await shot(page, "project", true);

  await projectTab(page, "Data").click();
  await page.getByLabel("Monthly revenue, Sep 2026").waitFor();
  await shot(page, "data");

  await page.goto("/projects/new");
  await page.getByLabel("Name", { exact: true }).fill("Habit app");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel(/^Monthly revenue/).fill("450");
  await page.getByLabel(/^Paying customers/).fill("30");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Monthly revenue I want").fill("3000");
  await shot(page, "setup");

  // Light theme, on a phone.
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
  });
  const mobile = await phone.newPage();
  await mobile.addInitScript(() => localStorage.setItem("projectpulse:theme", "light"));
  await freezeClock(mobile);
  await loadSampleProject(mobile);
  await mobile.waitForLoadState("networkidle");
  await mobile.screenshot({ path: "docs/screenshots/mobile-light.png", animations: "disabled" });
  await phone.close();
});
