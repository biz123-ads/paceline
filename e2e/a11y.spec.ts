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
    await page.goto("/");
    await audit(page, "empty projects");
    await loadSampleProject(page);
    await audit(page, "overview");
    for (const tab of ["Plan", "Data", "Details"]) {
      await projectTab(page, tab).click();
      await expect(projectTab(page, tab)).toHaveAttribute("aria-current", "page");
      await audit(page, tab);
    }
    await page.goto("/");
    await audit(page, "projects");
    await page.goto("/projects/new");
    await audit(page, "new project");
    await page.goto("/settings");
    await audit(page, "settings");
    await page.goto("/import");
    await audit(page, "import");
    for (const source of ["excel", "stripe"]) {
      await page.goto(`/import/${source}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await audit(page, `import ${source}`);
    }
  });
}
