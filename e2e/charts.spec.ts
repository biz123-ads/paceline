import { expect, test } from "@playwright/test";
import { addMonth, createProject, freezeClock, loadSampleProject } from "./helpers";

test.beforeEach(async ({ page }) => freezeClock(page));

test("sample project: who joined and left, what moves the goal most, costs", async ({ page }) => {
  await loadSampleProject(page);

  await page.getByRole("radio", { name: "Won and lost" }).click();
  await expect(
    page.getByText("55 customers joined and 17 left over 8 months: about 3.2 joined for every one who left."),
  ).toBeVisible();

  // The levers compared, and "Try it" moves the what-if number.
  await expect(page.getByText("What moves it most")).toBeVisible();
  await page.getByRole("button", { name: "Try it: charge a little more" }).click();
  await expect(page.getByRole("textbox", { name: "Price per customer" })).toHaveValue("22");
  await expect(page.getByText(/^With your numbers,/)).toBeVisible();

  // Revenue against costs marks the month they are covered.
  await expect(page.getByText("Covers costs", { exact: true })).toBeVisible();
});

test("without customers who joined or left, the chart says how to add them", async ({ page }) => {
  await createProject(page, "Plain app");
  await addMonth(page, "1000", "50");
  await page.getByRole("radio", { name: "Won and lost" }).click();
  await expect(page.getByText("Where do your customers come and go?")).toBeVisible();
  await page.getByRole("link", { name: "Fill them in" }).click();
  await expect(page).toHaveURL(/\/data$/);
});
