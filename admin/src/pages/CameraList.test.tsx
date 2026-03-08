import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import CameraList from "./CameraList";

vi.mock("../services/github-camera", () => ({
  listCameraFiles: vi.fn(),
  listCameraBranches: vi.fn(),
}));

vi.mock("../config", () => ({
  config: {
    repoOwner: "test-owner",
    repoName: "test-repo",
    repoBranch: "main",
  },
}));

import { listCameraFiles, listCameraBranches } from "../services/github-camera";

const TOKEN = "test-token";
const USERNAME = "test-user";

function renderList() {
  return render(
    <MemoryRouter>
      <CameraList token={TOKEN} username={USERNAME} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CameraList", () => {
  it("shows loading state while fetching", () => {
    vi.mocked(listCameraFiles).mockReturnValue(new Promise(() => {}));
    vi.mocked(listCameraBranches).mockReturnValue(new Promise(() => {}));
    renderList();
    expect(screen.getByText("Loading cameras...")).toBeInTheDocument();
  });

  it("shows error when fetch fails", async () => {
    vi.mocked(listCameraFiles).mockRejectedValue(new Error("Network error"));
    vi.mocked(listCameraBranches).mockResolvedValue([]);
    renderList();
    await waitFor(() =>
      expect(screen.getByText("Network error")).toBeInTheDocument(),
    );
  });

  it("shows published cameras grouped by manufacturer", async () => {
    vi.mocked(listCameraFiles).mockResolvedValue([
      { manufacturer: "nikon", manufacturerSlug: "nikon", model: "fe", modelSlug: "fe" },
      { manufacturer: "nikon", manufacturerSlug: "nikon", model: "f3", modelSlug: "f3" },
      { manufacturer: "pentax", manufacturerSlug: "pentax", model: "mx", modelSlug: "mx" },
    ]);
    vi.mocked(listCameraBranches).mockResolvedValue([]);
    renderList();
    await waitFor(() =>
      expect(screen.getByText("Published (3)")).toBeInTheDocument(),
    );
    expect(screen.getByText("nikon")).toBeInTheDocument();
    expect(screen.getByText("pentax")).toBeInTheDocument();
    expect(screen.getByText("fe")).toBeInTheDocument();
    expect(screen.getByText("f3")).toBeInTheDocument();
    expect(screen.getByText("mx")).toBeInTheDocument();
  });

  it("links cameras to their edit pages", async () => {
    vi.mocked(listCameraFiles).mockResolvedValue([
      { manufacturer: "nikon", manufacturerSlug: "nikon", model: "fe", modelSlug: "fe" },
    ]);
    vi.mocked(listCameraBranches).mockResolvedValue([]);
    renderList();
    await waitFor(() =>
      expect(screen.getByText("fe")).toBeInTheDocument(),
    );
    const link = screen.getByText("fe").closest("a");
    expect(link).toHaveAttribute("href", "/cameras/nikon/fe");
  });

  it("shows 'Edits in Progress' for edit branches", async () => {
    vi.mocked(listCameraFiles).mockResolvedValue([
      { manufacturer: "nikon", manufacturerSlug: "nikon", model: "fe", modelSlug: "fe" },
    ]);
    vi.mocked(listCameraBranches).mockResolvedValue([
      { name: "camera/edit/nikon/fe", commitSha: "abc" },
    ]);
    renderList();
    await waitFor(() =>
      expect(screen.getByText("Edits in Progress")).toBeInTheDocument(),
    );
    expect(screen.getByText("Editing")).toBeInTheDocument();
  });

  it("shows 'Unsubmitted Cameras' for new branches not yet published", async () => {
    vi.mocked(listCameraFiles).mockResolvedValue([]);
    vi.mocked(listCameraBranches).mockResolvedValue([
      { name: "camera/new/canon/ae-1", commitSha: "abc" },
    ]);
    renderList();
    await waitFor(() =>
      expect(screen.getByText("Unsubmitted Cameras")).toBeInTheDocument(),
    );
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("does not show unsubmitted section for new branches that are already published", async () => {
    vi.mocked(listCameraFiles).mockResolvedValue([
      { manufacturer: "canon", manufacturerSlug: "canon", model: "ae-1", modelSlug: "ae-1" },
    ]);
    vi.mocked(listCameraBranches).mockResolvedValue([
      { name: "camera/new/canon/ae-1", commitSha: "abc" },
    ]);
    renderList();
    await waitFor(() =>
      expect(screen.getByText("Published (1)")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Unsubmitted Cameras")).not.toBeInTheDocument();
  });

  it("has a link to create a new camera", async () => {
    vi.mocked(listCameraFiles).mockResolvedValue([]);
    vi.mocked(listCameraBranches).mockResolvedValue([]);
    renderList();
    await waitFor(() =>
      expect(screen.getByText("New camera")).toBeInTheDocument(),
    );
    expect(screen.getByText("New camera").closest("a")).toHaveAttribute("href", "/cameras/new");
  });

  it("continues rendering when branch listing fails", async () => {
    vi.mocked(listCameraFiles).mockResolvedValue([
      { manufacturer: "nikon", manufacturerSlug: "nikon", model: "fe", modelSlug: "fe" },
    ]);
    vi.mocked(listCameraBranches).mockRejectedValue(new Error("branch error"));
    renderList();
    await waitFor(() =>
      expect(screen.getByText("fe")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Edits in Progress")).not.toBeInTheDocument();
  });
});
