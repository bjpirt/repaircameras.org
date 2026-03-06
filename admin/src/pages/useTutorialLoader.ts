import { useEffect } from "react";
import {
  fetchTutorialJson,
  fetchTutorialJsonFromRef,
  listTutorialImages,
  listTutorialImagesFromRef,
  getRefSha,
} from "../services/github";
import type { EditorAction } from "./editorReducer";

export function useTutorialLoader(
  token: string,
  username: string,
  paramId: string | undefined,
  isNew: boolean,
  dispatch: React.Dispatch<EditorAction>,
): void {
  useEffect(() => {
    if (isNew) return;
    let cancelled = false;

    async function load() {
      try {
        // Try to detect an existing branch for auto-resume
        const branchesToTry = [`tutorial/edit/${paramId!}`, `tutorial/new/${paramId!}`];
        for (const branch of branchesToTry) {
          try {
            await getRefSha(token, username, branch);
            // Branch exists — load tutorial and images from it
            const [{ tutorial, sha }, images] = await Promise.all([
              fetchTutorialJsonFromRef(token, username, branch, paramId!),
              listTutorialImagesFromRef(token, username, branch, paramId!),
            ]);
            if (!cancelled) {
              dispatch({ type: "LOAD_TUTORIAL", tutorial, images, sha });
              dispatch({ type: "SET_FORK_BRANCH", forkOwner: username, branchName: branch });
            }
            return;
          } catch {
            // Branch doesn't exist, continue
          }
        }

        // Default: load from main repo
        const [{ tutorial, sha }, images] = await Promise.all([
          fetchTutorialJson(token, paramId!),
          listTutorialImages(token, paramId!),
        ]);
        if (!cancelled) {
          dispatch({ type: "LOAD_TUTORIAL", tutorial, images, sha });
        }
      } catch (err) {
        if (!cancelled) {
          dispatch({
            type: "SET_ERROR",
            message: err instanceof Error ? err.message : "Failed to load tutorial",
          });
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [token, paramId, isNew, username, dispatch]);
}
