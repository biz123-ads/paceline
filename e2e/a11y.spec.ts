import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { freezeClock, loadSampleProject, projectTab } from "./helpers";

test.beforeEach(async ({ page }) => freezeClock(page));

async function audit(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const summary = violations.map(
    (v) => `${where}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`,
  );
  expect(summary).toEqual([]);
}

for (const theme of ["dark", "light"] as const) {
  test(`every screen passes WCAG AA checks (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem("projectpulse:theme", t), theme);
    await page.goto("/projects");
    await expect(page.getByText("Where is your project heading?")).toBeVisible();
    await audit(page, "empty projects");
    await loadSampleProject(page);
    await audit(page, "overview");
    await page.getByRole("button", { name: "Add month" }).click();
    await page.getByRole("button", { name: /^More details/ }).click();
    await audit(page, "add month dialog");
    await page.keyboard.press("Escape");
    for (const tab of ["Data", "Settings"]) {
      await projectTab(page, tab).click();
      await expect(projectTab(page, tab)).toHaveAttribute("aria-current", "page");
      await audit(page, tab);
    }
    await page.goto("/projects");
    await audit(page, "projects");
    await page.goto("/projects/new");
    await audit(page, "setup");
    await page.goto("/settings");
    await audit(page, "settings");
  });
}
