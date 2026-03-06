import { test, expect } from "./fixtures";
import {
  setupTutorialListMocks,
  setupEmptyRepoMocks,
} from "./api-fixtures";

test.describe("Tutorial list", () => {
  test("shows published tutorials as cards", async ({ page }) => {
    await setupTutorialListMocks(page);
    await page.goto("/admin/tutorials");

    await expect(page.getByText("Olympus OM-1 Basic CLA")).toBeVisible();
    await expect(page.locator(".tutorial-card-meta").filter({ hasText: "Olympus OM-1" })).toBeVisible();
    await expect(page.getByText("A basic CLA of the Olympus OM-1.")).toBeVisible();
  });

  test("published tutorial card links to the editor", async ({ page }) => {
    await setupTutorialListMocks(page);
    await page.goto("/admin/tutorials");

    await expect(page.getByText("Olympus OM-1 Basic CLA")).toBeVisible();
    const link = page.getByRole("link", { name: "Olympus OM-1 Basic CLA" });
    await expect(link).toHaveAttribute("href", /\/tutorials\/olympus-om1-cla$/);
  });

  test("shows empty message when no published tutorials", async ({ page }) => {
    await setupEmptyRepoMocks(page);
    await page.goto("/admin/tutorials");

    await expect(
      page.getByText("No tutorials found in the repository."),
    ).toBeVisible();
  });

  test("shows Edits in Progress section when fork has an edit branch", async ({ page }) => {
    await setupTutorialListMocks(page, [
      { name: "tutorial/edit/olympus-om1-cla", commit: { sha: "def456" } },
    ]);
    await page.goto("/admin/tutorials");

    await expect(page.getByText("Edits in Progress")).toBeVisible();
    // Title appears in both the Edits section and the Published section
    await expect(page.getByText("Olympus OM-1 Basic CLA")).toHaveCount(2);
  });

  test("shows Unsubmitted Tutorials section for new-only fork branches", async ({ page }) => {
    await setupEmptyRepoMocks(page, [
      { name: "tutorial/new/pentax-mx-cla", commit: { sha: "abc123" } },
    ]);
    await page.goto("/admin/tutorials");

    await expect(page.getByText("Unsubmitted Tutorials")).toBeVisible();
    await expect(page.getByText("pentax-mx-cla")).toBeVisible();
  });

  test("New tutorial link navigates to the editor", async ({ page }) => {
    await setupEmptyRepoMocks(page);
    await page.goto("/admin/tutorials");

    await page.getByRole("link", { name: "New tutorial" }).click();
    await expect(page.getByText("New Tutorial")).toBeVisible();
  });
});
