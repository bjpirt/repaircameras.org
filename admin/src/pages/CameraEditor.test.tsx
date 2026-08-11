import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import CameraEditor from "./CameraEditor";

vi.mock("../services/github-camera", () => ({
  fetchCameraPage: vi.fn(),
  fetchCameraPageFromRef: vi.fn(),
  listPdfFiles: vi.fn(),
  listExistingLinks: vi.fn(),
  listCameraFiles: vi.fn(),
  saveCameraToForkBranch: vi.fn(),
}));

vi.mock("../services/github", () => ({
  listForkBranches: vi.fn(),
  createPullRequest: vi.fn(),
}));

vi.mock("../config", () => ({
  config: {
    repoOwner: "test-owner",
    repoName: "test-repo",
    repoBranch: "main",
  },
}));

import {
  fetchCameraPage,
  listPdfFiles,
  listExistingLinks,
  listCameraFiles,
  saveCameraToForkBranch,
} from "../services/github-camera";
import { listForkBranches, createPullRequest } from "../services/github";

const TOKEN = "test-token";
const USERNAME = "test-user";

const sampleCameraPage = {
  manufacturer: "Nikon",
  model: "FE",
  body: "A classic SLR.",
  relatedFiles: ["nikon-fe-manual"],
  relatedLinks: ["nikon-fe-video"],
  relatedArchives: ["nikon-fe-parts-list"],
  troubleshooting: [{ symptom: "Meter off", cause: "Battery", solution: "Replace battery" }],
};

function renderEditor(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: "/cameras/new",
        element: <CameraEditor token={TOKEN} username={USERNAME} />,
      },
      {
        path: "/cameras/:manufacturer/:model",
        element: <CameraEditor token={TOKEN} username={USERNAME} />,
      },
    ],
    { initialEntries: [path] },
  );
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no in-progress branches, empty resources
  vi.mocked(listForkBranches).mockResolvedValue([]);
  vi.mocked(listPdfFiles).mockResolvedValue([]);
  vi.mocked(listExistingLinks).mockResolvedValue([]);
  vi.mocked(listCameraFiles).mockResolvedValue([]);
});

// --- New camera ---

describe("CameraEditor — new camera", () => {
  it("renders the new camera form immediately", async () => {
    renderEditor("/cameras/new");
    await waitFor(() =>
      expect(screen.getByText("New Camera Page")).toBeInTheDocument(),
    );
    expect(screen.getByText("Manufacturer")).toBeInTheDocument();
    expect(screen.getByText("Model")).toBeInTheDocument();
    expect(screen.getByText("Manufacturer slug (directory name)")).toBeInTheDocument();
    expect(screen.getByText("Model slug (file name)")).toBeInTheDocument();
  });

  it("Submit PR button is disabled before saving to branch", async () => {
    renderEditor("/cameras/new");
    await waitFor(() =>
      expect(screen.getByText("New Camera Page")).toBeInTheDocument(),
    );
    expect(screen.getByText("Submit as PR")).toBeDisabled();
  });

  it("shows validation errors when required fields are empty", async () => {
    const user = userEvent.setup();
    renderEditor("/cameras/new");
    await waitFor(() =>
      expect(screen.getByText("New Camera Page")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Save to branch"));
    expect(screen.getByText(/Please fix the following/)).toBeInTheDocument();
  });

  it("saves to branch and shows success", async () => {
    const user = userEvent.setup();
    vi.mocked(saveCameraToForkBranch).mockResolvedValue({
      forkOwner: USERNAME,
      branchName: "camera/new/pentax/mx",
    });
    renderEditor("/cameras/new");
    await waitFor(() =>
      expect(screen.getByText("New Camera Page")).toBeInTheDocument(),
    );

    // Fill in required fields
    const inputs = screen.getAllByRole("textbox");
    // Manufacturer, Model, Manufacturer slug, Model slug, Description textarea
    const manufacturerInput = screen.getByText("Manufacturer").closest("label")!.querySelector("input")!;
    const modelInput = screen.getByText("Model").closest("label")!.querySelector("input")!;
    const mfgSlugInput = screen.getByText("Manufacturer slug (directory name)").closest("label")!.querySelector("input")!;
    const modelSlugInput = screen.getByText("Model slug (file name)").closest("label")!.querySelector("input")!;

    await user.type(manufacturerInput, "Pentax");
    await user.type(modelInput, "MX");
    await user.type(mfgSlugInput, "pentax");
    await user.type(modelSlugInput, "mx");

    await user.click(screen.getByText("Save to branch"));
    await waitFor(() =>
      expect(screen.getByText("Changes saved to branch.")).toBeInTheDocument(),
    );
    expect(saveCameraToForkBranch).toHaveBeenCalled();
  });
});

// --- Existing camera ---

describe("CameraEditor — existing camera", () => {
  beforeEach(() => {
    vi.mocked(fetchCameraPage).mockResolvedValue({
      cameraPage: sampleCameraPage,
      sha: "abc123",
    });
  });

  it("shows loading state while fetching", () => {
    vi.mocked(fetchCameraPage).mockReturnValue(new Promise(() => {}));
    renderEditor("/cameras/nikon/fe");
    expect(screen.getByText("Loading camera...")).toBeInTheDocument();
  });

  it("loads and shows camera data", async () => {
    renderEditor("/cameras/nikon/fe");
    await waitFor(() =>
      expect(screen.getByDisplayValue("Nikon")).toBeInTheDocument(),
    );
    expect(screen.getByDisplayValue("FE")).toBeInTheDocument();
    expect(screen.getByDisplayValue("A classic SLR.")).toBeInTheDocument();
  });

  it("shows 'Edit Camera Page' heading (not 'New Camera Page')", async () => {
    renderEditor("/cameras/nikon/fe");
    await waitFor(() =>
      expect(screen.getByText("Edit Camera Page")).toBeInTheDocument(),
    );
    expect(screen.queryByText("New Camera Page")).not.toBeInTheDocument();
  });

  it("does not show slug fields for existing cameras", async () => {
    renderEditor("/cameras/nikon/fe");
    await waitFor(() =>
      expect(screen.getByText("Edit Camera Page")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Manufacturer slug (directory name)")).not.toBeInTheDocument();
    expect(screen.queryByText("Model slug (file name)")).not.toBeInTheDocument();
  });

  it("shows load error when camera cannot be fetched", async () => {
    vi.mocked(fetchCameraPage).mockRejectedValue(new Error("Camera not found"));
    renderEditor("/cameras/nikon/missing");
    await waitFor(() =>
      expect(screen.getByText("Camera not found")).toBeInTheDocument(),
    );
  });

  it("saves and enables Submit PR button", async () => {
    const user = userEvent.setup();
    vi.mocked(saveCameraToForkBranch).mockResolvedValue({
      forkOwner: USERNAME,
      branchName: "camera/edit/nikon/fe",
    });
    renderEditor("/cameras/nikon/fe");
    await waitFor(() =>
      expect(screen.getByDisplayValue("Nikon")).toBeInTheDocument(),
    );

    // Make a change to enable save
    const manufacturerInput = screen.getByDisplayValue("Nikon");
    await user.clear(manufacturerInput);
    await user.type(manufacturerInput, "Nikon Corporation");

    await user.click(screen.getByText("Save to branch"));
    await waitFor(() =>
      expect(screen.getByText("Changes saved to branch.")).toBeInTheDocument(),
    );
    expect(screen.getByText("Submit as PR")).not.toBeDisabled();
  });

  it("preserves relatedArchives through a save, though the UI cannot edit it", async () => {
    const user = userEvent.setup();
    vi.mocked(saveCameraToForkBranch).mockResolvedValue({
      forkOwner: USERNAME,
      branchName: "camera/edit/nikon/fe",
    });
    renderEditor("/cameras/nikon/fe");
    await waitFor(() =>
      expect(screen.getByDisplayValue("Nikon")).toBeInTheDocument(),
    );

    const manufacturerInput = screen.getByDisplayValue("Nikon");
    await user.clear(manufacturerInput);
    await user.type(manufacturerInput, "Nikon Corporation");

    await user.click(screen.getByText("Save to branch"));
    await waitFor(() => expect(saveCameraToForkBranch).toHaveBeenCalled());

    const savedCameraPage = vi.mocked(saveCameraToForkBranch).mock.calls[0][7];
    expect(savedCameraPage.relatedArchives).toEqual(["nikon-fe-parts-list"]);
  });

  it("submits a PR with 'Update camera' title for edits", async () => {
    const user = userEvent.setup();
    vi.mocked(saveCameraToForkBranch).mockResolvedValue({
      forkOwner: USERNAME,
      branchName: "camera/edit/nikon/fe",
    });
    vi.mocked(createPullRequest).mockResolvedValue({
      number: 42,
      html_url: "https://github.com/test-owner/test-repo/pull/42",
    });
    renderEditor("/cameras/nikon/fe");
    await waitFor(() =>
      expect(screen.getByDisplayValue("Nikon")).toBeInTheDocument(),
    );

    // Save first
    const manufacturerInput = screen.getByDisplayValue("Nikon");
    await user.clear(manufacturerInput);
    await user.type(manufacturerInput, "Nikon");
    await user.click(screen.getByText("Save to branch"));
    await waitFor(() =>
      expect(screen.getByText("Changes saved to branch.")).toBeInTheDocument(),
    );

    // Submit PR
    await user.click(screen.getByText("Submit as PR"));
    await waitFor(() =>
      expect(screen.getByText(/#42/)).toBeInTheDocument(),
    );
    expect(createPullRequest).toHaveBeenCalledWith(
      TOKEN,
      "Update camera: Nikon FE",
      expect.stringContaining("Updates the Nikon FE"),
      expect.any(String),
      "main",
    );
  });
});
