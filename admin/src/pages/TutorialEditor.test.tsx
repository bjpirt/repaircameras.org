import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import TutorialEditor from "./TutorialEditor";

vi.mock("../services/github", () => ({
  fetchTutorialJson: vi.fn(),
  fetchTutorialJsonFromRef: vi.fn(),
  listTutorialImages: vi.fn(),
  listTutorialImagesFromRef: vi.fn(),
  saveToForkBranch: vi.fn(),
  createPullRequest: vi.fn(),
  getRefSha: vi.fn(),
}));

vi.mock("../config", () => ({
  config: {
    repoOwner: "test-owner",
    repoName: "test-repo",
    repoBranch: "main",
  },
}));

// Stub StepEditor so tests don't need to deal with photo/annotation complexity
vi.mock("./StepEditor", () => ({
  default: ({ index }: { index: number }) => (
    <div data-testid={`step-editor-${index}`} />
  ),
}));

import {
  fetchTutorialJson,
  fetchTutorialJsonFromRef,
  listTutorialImages,
  listTutorialImagesFromRef,
  saveToForkBranch,
  createPullRequest,
  getRefSha,
} from "../services/github";

const TOKEN = "test-token";
const USERNAME = "test-user";

const sampleTutorial = {
  id: "olympus-om1-cla",
  title: "Olympus OM-1 Basic CLA",
  manufacturer: "Olympus",
  model: "OM-1",
  description: "A basic CLA of the Olympus OM-1.",
  tools: ["JIS screwdrivers", "Spanner wrench"],
  steps: [],
};

function renderEditor(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: "/tutorials/:id",
        element: <TutorialEditor token={TOKEN} username={USERNAME} />,
      },
    ],
    { initialEntries: [path] },
  );
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// --- New tutorial ---

describe("TutorialEditor — new tutorial", () => {
  it("renders the new tutorial form immediately", () => {
    renderEditor("/tutorials/new");
    expect(screen.getByText("New Tutorial")).toBeInTheDocument();
    expect(screen.getByLabelText("ID (slug)")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Manufacturer")).toBeInTheDocument();
    expect(screen.getByLabelText("Model")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
  });

  it("Submit PR button is disabled before saving to branch", () => {
    renderEditor("/tutorials/new");
    expect(screen.getByText("Submit as PR")).toBeDisabled();
  });

  it("shows validation error when ID is invalid", async () => {
    const user = userEvent.setup();
    renderEditor("/tutorials/new");
    await user.type(screen.getByLabelText("ID (slug)"), "INVALID ID!");
    await user.click(screen.getByText("Save to branch"));
    expect(
      screen.getByText(/ID must be kebab-case/),
    ).toBeInTheDocument();
  });

  it("shows validation error when a step has no intro or substeps", async () => {
    const user = userEvent.setup();
    renderEditor("/tutorials/new");
    await user.type(screen.getByLabelText("ID (slug)"), "my-tutorial");
    await user.type(screen.getByLabelText("Title"), "My Tutorial");
    await user.type(screen.getByLabelText("Manufacturer"), "Olympus");
    await user.type(screen.getByLabelText("Model"), "OM-1");
    await user.type(screen.getByLabelText("Description"), "A test.");
    // Add an empty step — no intro, no substeps — fails the step refine
    await user.click(screen.getByText("+ Add step"));
    await user.click(screen.getByText("Save to branch"));
    expect(saveToForkBranch).not.toHaveBeenCalled();
    expect(screen.getByText(/Please fix the following/)).toBeInTheDocument();
  });

  it("can add and remove a tool", async () => {
    const user = userEvent.setup();
    renderEditor("/tutorials/new");
    await user.click(screen.getByText("+ Add tool"));
    const removeBtn = screen.getByTitle("Remove tool");
    expect(removeBtn).toBeInTheDocument();
    await user.click(removeBtn);
    expect(screen.queryByTitle("Remove tool")).not.toBeInTheDocument();
  });

  it("can add a step", async () => {
    const user = userEvent.setup();
    renderEditor("/tutorials/new");
    await user.click(screen.getByText("+ Add step"));
    expect(screen.getByTestId("step-editor-0")).toBeInTheDocument();
  });

  it("saves to branch and shows success", async () => {
    const user = userEvent.setup();
    vi.mocked(saveToForkBranch).mockResolvedValue({
      forkOwner: USERNAME,
      branchName: "tutorial/new/my-tutorial",
    });
    renderEditor("/tutorials/new");
    await user.type(screen.getByLabelText("ID (slug)"), "my-tutorial");
    await user.type(screen.getByLabelText("Title"), "My Tutorial");
    await user.type(screen.getByLabelText("Manufacturer"), "Olympus");
    await user.type(screen.getByLabelText("Model"), "OM-1");
    await user.type(screen.getByLabelText("Description"), "A test tutorial.");
    await user.click(screen.getByText("Save to branch"));
    await waitFor(() =>
      expect(
        screen.getByText("Saved to branch successfully."),
      ).toBeInTheDocument(),
    );
    expect(saveToForkBranch).toHaveBeenCalledWith(
      TOKEN,
      USERNAME,
      null,
      null,
      "tutorial/new/my-tutorial",
      "my-tutorial",
      expect.objectContaining({ title: "My Tutorial" }),
      [],
      expect.any(Function),
    );
  });

  it("shows error when save fails", async () => {
    const user = userEvent.setup();
    vi.mocked(saveToForkBranch).mockRejectedValue(new Error("GitHub API error"));
    renderEditor("/tutorials/new");
    await user.type(screen.getByLabelText("ID (slug)"), "my-tutorial");
    await user.type(screen.getByLabelText("Title"), "My Tutorial");
    await user.type(screen.getByLabelText("Manufacturer"), "Olympus");
    await user.type(screen.getByLabelText("Model"), "OM-1");
    await user.type(screen.getByLabelText("Description"), "A test.");
    await user.click(screen.getByText("Save to branch"));
    await waitFor(() =>
      expect(screen.getByText("GitHub API error")).toBeInTheDocument(),
    );
  });

  it("enables Submit PR after a successful branch save", async () => {
    const user = userEvent.setup();
    vi.mocked(saveToForkBranch).mockResolvedValue({
      forkOwner: USERNAME,
      branchName: "tutorial/new/my-tutorial",
    });
    renderEditor("/tutorials/new");
    await user.type(screen.getByLabelText("ID (slug)"), "my-tutorial");
    await user.type(screen.getByLabelText("Title"), "My Tutorial");
    await user.type(screen.getByLabelText("Manufacturer"), "Olympus");
    await user.type(screen.getByLabelText("Model"), "OM-1");
    await user.type(screen.getByLabelText("Description"), "A test.");
    await user.click(screen.getByText("Save to branch"));
    await waitFor(() =>
      expect(screen.getByText("Saved to branch successfully.")).toBeInTheDocument(),
    );
    expect(screen.getByText("Submit as PR")).not.toBeDisabled();
  });
});

// --- Existing tutorial ---

describe("TutorialEditor — existing tutorial", () => {
  beforeEach(() => {
    // No in-progress branches by default
    vi.mocked(getRefSha).mockRejectedValue(new Error("Not found"));
    vi.mocked(fetchTutorialJson).mockResolvedValue({
      tutorial: sampleTutorial,
      sha: "abc123",
    });
    vi.mocked(listTutorialImages).mockResolvedValue([]);
  });

  it("shows loading state while fetching", () => {
    vi.mocked(fetchTutorialJson).mockReturnValue(new Promise(() => {}));
    renderEditor("/tutorials/olympus-om1-cla");
    expect(screen.getByText("Loading tutorial...")).toBeInTheDocument();
  });

  it("loads and shows tutorial data", async () => {
    renderEditor("/tutorials/olympus-om1-cla");
    await waitFor(() =>
      expect(
        screen.getByDisplayValue("Olympus OM-1 Basic CLA"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByDisplayValue("Olympus")).toBeInTheDocument();
    expect(screen.getByDisplayValue("OM-1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("JIS screwdrivers")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Spanner wrench")).toBeInTheDocument();
  });

  it("shows 'Edit Tutorial' heading (not 'New Tutorial')", async () => {
    renderEditor("/tutorials/olympus-om1-cla");
    await waitFor(() =>
      expect(screen.getByText("Edit Tutorial")).toBeInTheDocument(),
    );
    expect(screen.queryByText("New Tutorial")).not.toBeInTheDocument();
  });

  it("does not show the ID field for existing tutorials", async () => {
    renderEditor("/tutorials/olympus-om1-cla");
    await waitFor(() =>
      expect(screen.getByText("Edit Tutorial")).toBeInTheDocument(),
    );
    expect(screen.queryByLabelText("ID (slug)")).not.toBeInTheDocument();
  });

  it("shows load error when tutorial cannot be fetched", async () => {
    // Set mocks explicitly here to avoid relying solely on beforeEach
    vi.mocked(getRefSha).mockRejectedValue(new Error("Not found"));
    vi.mocked(fetchTutorialJson).mockRejectedValue(new Error("Tutorial not found"));
    renderEditor("/tutorials/missing-tutorial");
    await waitFor(() =>
      expect(screen.getByText("Tutorial not found")).toBeInTheDocument(),
    );
  });

  it("auto-resumes from an existing edit branch", async () => {
    vi.mocked(getRefSha).mockResolvedValueOnce("branch-sha"); // edit branch found
    vi.mocked(fetchTutorialJsonFromRef).mockResolvedValue({
      tutorial: sampleTutorial,
      sha: "branch-abc",
    });
    vi.mocked(listTutorialImagesFromRef).mockResolvedValue([]);
    renderEditor("/tutorials/olympus-om1-cla");
    await waitFor(() =>
      expect(
        screen.getByDisplayValue("Olympus OM-1 Basic CLA"),
      ).toBeInTheDocument(),
    );
    // Should show the branch name in status bar
    expect(
      screen.getByText(/tutorial\/edit\/olympus-om1-cla/),
    ).toBeInTheDocument();
    // Should NOT have fetched from main
    expect(fetchTutorialJson).not.toHaveBeenCalled();
  });

  it("submits a PR with 'Update tutorial' title for edits", async () => {
    const user = userEvent.setup();
    vi.mocked(saveToForkBranch).mockResolvedValue({
      forkOwner: USERNAME,
      branchName: "tutorial/edit/olympus-om1-cla",
    });
    vi.mocked(createPullRequest).mockResolvedValue({
      number: 42,
      html_url: "https://github.com/test-owner/test-repo/pull/42",
    });
    renderEditor("/tutorials/olympus-om1-cla");
    await waitFor(() =>
      expect(
        screen.getByDisplayValue("Olympus OM-1 Basic CLA"),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Save to branch"));
    await waitFor(() =>
      expect(screen.getByText("Saved to branch successfully.")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Submit as PR"));
    await waitFor(() =>
      expect(screen.getByText(/#42/)).toBeInTheDocument(),
    );
    expect(createPullRequest).toHaveBeenCalledWith(
      TOKEN,
      "Update tutorial: Olympus OM-1 Basic CLA",
      expect.stringContaining("Updates the Olympus OM-1"),
      expect.any(String),
      "main",
    );
  });
});
