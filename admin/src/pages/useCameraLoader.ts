import { useEffect } from "react";
import type { CameraEditorAction } from "./cameraEditorReducer";
import {
  fetchCameraPage,
  fetchCameraPageFromRef,
  listPdfFiles,
  listExistingLinks,
  listCameraFiles,
} from "../services/github-camera";
import { listForkBranches } from "../services/github";

export function useCameraLoader(
  token: string,
  username: string,
  manufacturerSlug: string,
  modelSlug: string,
  isNew: boolean,
  dispatch: React.Dispatch<CameraEditorAction>,
) {
  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        // Load available resources in parallel with camera data
        const resourcesPromise = Promise.all([
          listPdfFiles(token),
          listExistingLinks(token),
          listCameraFiles(token).then((cameras) => [
            ...new Set(cameras.map((c) => c.manufacturerSlug)),
          ]),
        ]);

        if (!isNew) {
          // Try to find an existing edit branch
          const editPrefix = `camera/edit/${manufacturerSlug}/${modelSlug}`;
          const newPrefix = `camera/new/${manufacturerSlug}/${modelSlug}`;

          const branches = await listForkBranches(token, username, "camera/");
          const editBranch = branches.find(
            (b) => b.name === editPrefix || b.name === newPrefix,
          );

          if (editBranch) {
            // Resume from fork branch
            const result = await fetchCameraPageFromRef(
              token,
              username,
              editBranch.name,
              manufacturerSlug,
              modelSlug,
            );
            dispatch({ type: "LOAD_CAMERA", cameraPage: result.cameraPage, sha: result.sha });
            dispatch({ type: "SET_FORK_BRANCH", forkOwner: username, branchName: editBranch.name });
          } else {
            // Load from main repo
            const result = await fetchCameraPage(token, manufacturerSlug, modelSlug);
            dispatch({ type: "LOAD_CAMERA", cameraPage: result.cameraPage, sha: result.sha });
          }
        }

        const [pdfs, links, manufacturers] = await resourcesPromise;
        dispatch({ type: "SET_AVAILABLE_PDFS", pdfs });
        dispatch({ type: "SET_AVAILABLE_LINKS", links });
        dispatch({ type: "SET_EXISTING_MANUFACTURERS", manufacturers });

        if (isNew) {
          dispatch({ type: "SET_LOADING", loading: false });
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          dispatch({
            type: "SET_ERROR",
            error: err instanceof Error ? err.message : "Failed to load",
          });
        }
      }
    }

    load();

    return () => controller.abort();
  }, [token, username, manufacturerSlug, modelSlug, isNew, dispatch]);
}
