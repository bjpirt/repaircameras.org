import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import TutorialList from "./TutorialList";

vi.mock("../services/github", () => ({
  listTutorialFiles: vi.fn(),
  fetchTutorialJson: vi.fn(),
  listForkBranches: vi.fn(),
}));

vi.mock("../config", () => ({
  config: {
    repoOwner: "test-owner",
    repoName: "test-repo",
    repoBranch: "main",
  },
}));

import { listTutorialFiles, fetchTutorialJson, listForkBranches } from "../services/github";

const TOKEN = "test-token";
const USERNAME = "test-user";

const sampleTutorial = {
  id: "olympus-om1-cla",
  title: "Olympus OM-1 Basic CLA",
  manufacturer: "Olympus",
  model: "OM-1",
  description: "A basic CLA of the Olympus OM-1.",
  tools: [],
  prerequisites: [],
  steps: [{ title: "Step 1", substeps: [], photos: [] }],
};

function renderList() {
  return render(
    <MemoryRouter>
      <TutorialList token={TOKEN} username={USERNAME} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TutorialList", () => {
  it("shows loading state while fetching", () => {
    vi.mocked(listTutorialFiles).mockReturnValue(new Promise(() => {}));
    renderList();
    expect(screen.getByText("Loading tutorials...")).toBeInTheDocument();
  });

  it("shows error when fetch fails", async () => {
    vi.mocked(listTutorialFiles).mockRejectedValue(new Error("Network error"));
    renderList();
    await waitFor(() =>
      expect(screen.getByText("Network error")).toBeInTheDocument(),
    );
  });

  it("shows empty message when no published tutorials", async () => {
    vi.mocked(listTutorialFiles).mockResolvedValue([]);
    vi.mocked(listForkBranches).mockResolvedValue([]);
    renderList();
    await waitFor(() =>
      expect(
        screen.getByText("No tutorials found in the repository."),
      ).toBeInTheDocument(),
    );
  });

  it("shows published tutorials with title and meta", async () => {
    vi.mocked(listTutorialFiles).mockResolvedValue([{ id: "olympus-om1-cla", name: "olympus-om1-cla", path: "site/tutorials/olympus-om1-cla", sha: "abc" }]);
    vi.mocked(fetchTutorialJson).mockResolvedValue({
      tutorial: sampleTutorial,
      sha: "abc",
    });
    vi.mocked(listForkBranches).mockResolvedValue([]);
    renderList();
    await waitFor(() =>
      expect(screen.getByText("Olympus OM-1 Basic CLA")).toBeInTheDocument(),
    );
    expect(screen.getByText("A basic CLA of the Olympus OM-1.")).toBeInTheDocument();
    // Meta shows manufacturer + model + step count
    expect(screen.getAllByText(/Olympus OM-1/).length).toBeGreaterThan(0);
  });

  it("links published tutorials to their edit pages", async () => {
    vi.mocked(listTutorialFiles).mockResolvedValue([{ id: "olympus-om1-cla", name: "olympus-om1-cla", path: "site/tutorials/olympus-om1-cla", sha: "abc" }]);
    vi.mocked(fetchTutorialJson).mockResolvedValue({
      tutorial: sampleTutorial,
      sha: "abc",
    });
    vi.mocked(listForkBranches).mockResolvedValue([]);
    renderList();
    await waitFor(() =>
      expect(screen.getByText("Olympus OM-1 Basic CLA")).toBeInTheDocument(),
    );
    const link = screen
      .getByText("Olympus OM-1 Basic CLA")
      .closest("a");
    expect(link).toHaveAttribute("href", "/tutorials/olympus-om1-cla");
  });

  it("shows 'Edits in Progress' section when an edit branch exists", async () => {
    vi.mocked(listTutorialFiles).mockResolvedValue([{ id: "olympus-om1-cla", name: "olympus-om1-cla", path: "site/tutorials/olympus-om1-cla", sha: "abc" }]);
    vi.mocked(fetchTutorialJson).mockResolvedValue({
      tutorial: sampleTutorial,
      sha: "abc",
    });
    vi.mocked(listForkBranches).mockResolvedValue([
      { name: "tutorial/edit/olympus-om1-cla", commitSha: "def" },
    ]);
    renderList();
    await waitFor(() =>
      expect(screen.getByText("Edits in Progress")).toBeInTheDocument(),
    );
    // Tutorial title appears in both the edits section and published section
    expect(screen.getAllByText("Olympus OM-1 Basic CLA")).toHaveLength(2);
  });

  it("shows 'Unsubmitted Tutorials' section for new draft branches", async () => {
    vi.mocked(listTutorialFiles).mockResolvedValue([]);
    vi.mocked(listForkBranches).mockResolvedValue([
      { name: "tutorial/new/pentax-mx-cla", commitSha: "abc" },
    ]);
    renderList();
    await waitFor(() =>
      expect(screen.getByText("Unsubmitted Tutorials")).toBeInTheDocument(),
    );
    expect(screen.getByText("pentax-mx-cla")).toBeInTheDocument();
  });

  it("does not show unsubmitted section for branches that are already published", async () => {
    vi.mocked(listTutorialFiles).mockResolvedValue([{ id: "olympus-om1-cla", name: "olympus-om1-cla", path: "site/tutorials/olympus-om1-cla", sha: "abc" }]);
    vi.mocked(fetchTutorialJson).mockResolvedValue({
      tutorial: sampleTutorial,
      sha: "abc",
    });
    vi.mocked(listForkBranches).mockResolvedValue([
      { name: "tutorial/new/olympus-om1-cla", commitSha: "abc" },
    ]);
    renderList();
    await waitFor(() =>
      expect(screen.getByText("Published")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Unsubmitted Tutorials")).not.toBeInTheDocument();
  });

  it("has a link to create a new tutorial", async () => {
    vi.mocked(listTutorialFiles).mockResolvedValue([]);
    vi.mocked(listForkBranches).mockResolvedValue([]);
    renderList();
    await waitFor(() =>
      expect(screen.getByText("New tutorial")).toBeInTheDocument(),
    );
    expect(screen.getByText("New tutorial").closest("a")).toHaveAttribute(
      "href",
      "/tutorials/new",
    );
  });

  it("continues rendering even when branch listing fails", async () => {
    vi.mocked(listTutorialFiles).mockResolvedValue([{ id: "olympus-om1-cla", name: "olympus-om1-cla", path: "site/tutorials/olympus-om1-cla", sha: "abc" }]);
    vi.mocked(fetchTutorialJson).mockResolvedValue({
      tutorial: sampleTutorial,
      sha: "abc",
    });
    vi.mocked(listForkBranches).mockRejectedValue(new Error("branch error"));
    renderList();
    await waitFor(() =>
      expect(screen.getByText("Olympus OM-1 Basic CLA")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Edits in Progress")).not.toBeInTheDocument();
  });
});
