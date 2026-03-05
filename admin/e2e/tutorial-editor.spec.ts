import { test, expect } from "./fixtures";
import {
  setupNoBranchMocks,
  setupLoadFromMainMocks,
  setupAutoResumeMocks,
  setupSaveToNewBranchMocks,
  setupSaveToExistingBranchMocks,
  setupSubmitPRMocks,
} from "./api-fixtures";

// --- New tutorial ---

test.describe("TutorialEditor — new tutorial", () => {
  test("shows empty form with all required fields", async ({ page }) => {
    await page.goto("/admin/tutorials/new");

    await expect(page.getByText("New Tutorial")).toBeVisible();
    await expect(page.getByLabel("ID (slug)")).toBeVisible();
    await expect(page.getByLabel("Title")).toBeVisible();
    await expect(page.getByLabel("Manufacturer")).toBeVisible();
    await expect(page.getByLabel("Model")).toBeVisible();
    await expect(page.getByLabel("Description")).toBeVisible();
  });

  test("Submit as PR is disabled before saving to branch", async ({ page }) => {
    await page.goto("/admin/tutorials/new");
    await expect(page.getByRole("button", { name: "Submit as PR" })).toBeDisabled();
  });

  test("can fill form and save a new tutorial to a branch", async ({ page }) => {
    await setupSaveToNewBranchMocks(page);

    await page.goto("/admin/tutorials/new");
    await page.getByLabel("ID (slug)").fill("my-tutorial");
    await page.getByLabel("Title").fill("My Tutorial");
    await page.getByLabel("Manufacturer").fill("Olympus");
    await page.getByLabel("Model").fill("OM-1");
    await page.getByLabel("Description").fill("A test tutorial.");

    await page.getByRole("button", { name: "Save to branch" }).click();

    await expect(page.getByText("Saved to branch successfully.")).toBeVisible();
  });

  test("Submit as PR is enabled after a successful branch save", async ({ page }) => {
    await setupSaveToNewBranchMocks(page);

    await page.goto("/admin/tutorials/new");
    await page.getByLabel("ID (slug)").fill("my-tutorial");
    await page.getByLabel("Title").fill("My Tutorial");
    await page.getByLabel("Manufacturer").fill("Olympus");
    await page.getByLabel("Model").fill("OM-1");
    await page.getByLabel("Description").fill("A test tutorial.");

    await page.getByRole("button", { name: "Save to branch" }).click();
    await expect(page.getByText("Saved to branch successfully.")).toBeVisible();

    await expect(page.getByRole("button", { name: "Submit as PR" })).toBeEnabled();
  });

  test("can save to branch and then submit a PR", async ({ page }) => {
    await setupSaveToNewBranchMocks(page);
    await setupSubmitPRMocks(page);

    await page.goto("/admin/tutorials/new");
    await page.getByLabel("ID (slug)").fill("my-tutorial");
    await page.getByLabel("Title").fill("My Tutorial");
    await page.getByLabel("Manufacturer").fill("Olympus");
    await page.getByLabel("Model").fill("OM-1");
    await page.getByLabel("Description").fill("A test tutorial.");

    await page.getByRole("button", { name: "Save to branch" }).click();
    await expect(page.getByText("Saved to branch successfully.")).toBeVisible();

    await page.getByRole("button", { name: "Submit as PR" }).click();
    await expect(page.getByText(/#42/)).toBeVisible();
  });

  test("shows validation errors when saving a tutorial with an empty step", async ({ page }) => {
    await page.goto("/admin/tutorials/new");
    await page.getByLabel("ID (slug)").fill("my-tutorial");
    await page.getByLabel("Title").fill("My Tutorial");
    await page.getByLabel("Manufacturer").fill("Olympus");
    await page.getByLabel("Model").fill("OM-1");
    await page.getByLabel("Description").fill("A test tutorial.");
    await page.getByRole("button", { name: "+ Add step" }).click();
    await page.getByRole("button", { name: "Save to branch" }).click();

    await expect(page.getByText("Please fix the following:")).toBeVisible();
  });
});

// --- Existing tutorial ---

test.describe("TutorialEditor — existing tutorial", () => {
  test("loads and populates form from main repo", async ({ page }) => {
    await setupNoBranchMocks(page);
    await setupLoadFromMainMocks(page);

    await page.goto("/admin/tutorials/olympus-om1-cla");

    // Wait for async load to complete by checking input values
    await expect(page.getByLabel("Title")).toHaveValue("Olympus OM-1 Basic CLA");
    await expect(page.getByLabel("Manufacturer")).toHaveValue("Olympus");
    await expect(page.getByLabel("Model")).toHaveValue("OM-1");
    // ID field is not shown for existing tutorials
    await expect(page.getByLabel("ID (slug)")).not.toBeVisible();
  });

  test("shows Edit Tutorial heading, not New Tutorial", async ({ page }) => {
    await setupNoBranchMocks(page);
    await setupLoadFromMainMocks(page);

    await page.goto("/admin/tutorials/olympus-om1-cla");

    await expect(page.getByText("Edit Tutorial")).toBeVisible();
    await expect(page.getByText("New Tutorial")).not.toBeVisible();
  });

  test("auto-resumes from an existing edit branch", async ({ page }) => {
    await setupAutoResumeMocks(page);

    await page.goto("/admin/tutorials/olympus-om1-cla");

    await expect(page.getByLabel("Title")).toHaveValue("Olympus OM-1 Basic CLA");
    // Branch name shown in the status bar
    await expect(page.getByText(/tutorial\/edit\/olympus-om1-cla/)).toBeVisible();
  });

  test("can save an existing tutorial to a new branch", async ({ page }) => {
    await setupNoBranchMocks(page);
    await setupLoadFromMainMocks(page);
    await setupSaveToNewBranchMocks(page);

    await page.goto("/admin/tutorials/olympus-om1-cla");
    await expect(page.getByLabel("Title")).toHaveValue("Olympus OM-1 Basic CLA");

    await page.getByRole("button", { name: "Save to branch" }).click();
    await expect(page.getByText("Saved to branch successfully.")).toBeVisible();
  });

  test("can save to existing edit branch when auto-resumed", async ({ page }) => {
    await setupAutoResumeMocks(page);
    await setupSaveToExistingBranchMocks(page);

    await page.goto("/admin/tutorials/olympus-om1-cla");
    await expect(page.getByLabel("Title")).toHaveValue("Olympus OM-1 Basic CLA");

    await page.getByRole("button", { name: "Save to branch" }).click();
    await expect(page.getByText("Saved to branch successfully.")).toBeVisible();
  });

  test("unsaved changes prompt appears when navigating away", async ({ page }) => {
    await setupNoBranchMocks(page);
    await setupLoadFromMainMocks(page);

    await page.goto("/admin/tutorials/olympus-om1-cla");
    await expect(page.getByLabel("Title")).toHaveValue("Olympus OM-1 Basic CLA");

    // Make a change to mark the form as dirty
    await page.getByLabel("Title").fill("Modified Title");

    // Try to navigate away via Back to list
    await page.getByRole("link", { name: "Back to list" }).click();

    await expect(page.getByText("You have unsaved changes. Leave anyway?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Stay" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Leave" })).toBeVisible();
  });

  test("shows error screen when the tutorial fails to load", async ({ page }) => {
    await setupNoBranchMocks(page);
    // Tutorial JSON returns 404 — no mock for it so the catch-all fires... but we need a specific 404
    await page.route(
      (url) =>
        url.hostname === "api.github.com" &&
        url.pathname ===
          "/repos/bjpirt/repaircameras.org/contents/site/tutorials/missing-tutorial/tutorial.json",
      (route) =>
        route.fulfill({ status: 404, body: '{"message":"Not Found"}' }),
    );

    await page.goto("/admin/tutorials/missing-tutorial");

    await expect(page.getByText(/Failed to fetch tutorial/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to list" })).toBeVisible();
  });

  test("can proceed through the unsaved changes prompt", async ({ page }) => {
    await setupNoBranchMocks(page);
    await setupLoadFromMainMocks(page);

    await page.goto("/admin/tutorials/olympus-om1-cla");
    await expect(page.getByLabel("Title")).toHaveValue("Olympus OM-1 Basic CLA");

    await page.getByLabel("Title").fill("Modified Title");
    await page.getByRole("link", { name: "Back to list" }).click();
    await expect(page.getByText("You have unsaved changes. Leave anyway?")).toBeVisible();

    // Register list page routes before navigating
    await page.route(/\/contents\/site\/tutorials(\?|$)/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
    );
    await page.route(/\/repos\/test-user\/repaircameras\.org\/branches/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
    );

    await page.getByRole("button", { name: "Leave" }).click();
    await expect(page.getByRole("heading", { name: "Tutorials" })).toBeVisible();
  });
});
