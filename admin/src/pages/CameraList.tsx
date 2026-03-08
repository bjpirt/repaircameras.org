import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  listCameraFiles,
  listCameraBranches,
  type CameraFileEntry,
} from "../services/github-camera";
import type { ForkBranch } from "../services/github";
import "./CameraList.css";

interface Props {
  token: string;
  username: string;
}

interface ParsedBranch {
  type: "edit" | "new";
  manufacturer: string;
  model: string;
}

function parseCameraBranch(branch: ForkBranch): ParsedBranch | null {
  for (const prefix of ["camera/edit/", "camera/new/"] as const) {
    if (branch.name.startsWith(prefix)) {
      const rest = branch.name.slice(prefix.length);
      const parts = rest.split("/");
      if (parts.length === 2) {
        return {
          type: prefix.includes("edit") ? "edit" : "new",
          manufacturer: parts[0],
          model: parts[1],
        };
      }
    }
  }
  return null;
}

export default function CameraList({ token, username }: Props) {
  const [cameras, setCameras] = useState<CameraFileEntry[]>([]);
  const [editBranches, setEditBranches] = useState<ParsedBranch[]>([]);
  const [newBranches, setNewBranches] = useState<ParsedBranch[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [cameraFiles, branches] = await Promise.all([
          listCameraFiles(token),
          listCameraBranches(token, username).catch(() => [] as ForkBranch[]),
        ]);

        if (!cancelled) {
          setCameras(cameraFiles);

          const edits: ParsedBranch[] = [];
          const news: ParsedBranch[] = [];
          for (const branch of branches) {
            const parsed = parseCameraBranch(branch);
            if (parsed?.type === "edit") edits.push(parsed);
            if (parsed?.type === "new") news.push(parsed);
          }
          setEditBranches(edits);
          setNewBranches(news);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load cameras");
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [token, username]);

  if (loading) return <div className="loading">Loading cameras...</div>;
  if (error) return <div className="error-screen"><p>{error}</p></div>;

  const lowerFilter = filter.toLowerCase();
  const filteredCameras = lowerFilter
    ? cameras.filter(
        (c) =>
          c.manufacturer.toLowerCase().includes(lowerFilter) ||
          c.model.toLowerCase().includes(lowerFilter),
      )
    : cameras;

  // Group by manufacturer
  const grouped = new Map<string, CameraFileEntry[]>();
  for (const camera of filteredCameras) {
    const list = grouped.get(camera.manufacturerSlug) ?? [];
    list.push(camera);
    grouped.set(camera.manufacturerSlug, list);
  }

  const publishedKeys = new Set(cameras.map((c) => `${c.manufacturerSlug}/${c.modelSlug}`));
  const unsubmitted = newBranches.filter(
    (b) => !publishedKeys.has(`${b.manufacturer}/${b.model}`),
  );

  return (
    <div className="camera-list">
      <div className="camera-list-header">
        <h2>Camera Pages</h2>
        <Link to="/cameras/new" className="btn-primary">New camera</Link>
      </div>

      <input
        type="text"
        className="camera-filter"
        placeholder="Filter cameras..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {editBranches.length > 0 && (
        <section className="camera-section">
          <h3 className="camera-section-title">Edits in Progress</h3>
          <div className="camera-cards">
            {editBranches.map((b) => (
              <Link
                key={`${b.manufacturer}/${b.model}`}
                to={`/cameras/${b.manufacturer}/${b.model}`}
                className="camera-card camera-card--edit"
              >
                <div className="camera-card-title">{b.manufacturer} / {b.model}</div>
                <div className="camera-card-badge camera-card-badge--edit">Editing</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {unsubmitted.length > 0 && (
        <section className="camera-section">
          <h3 className="camera-section-title">Unsubmitted Cameras</h3>
          <div className="camera-cards">
            {unsubmitted.map((b) => (
              <Link
                key={`${b.manufacturer}/${b.model}`}
                to={`/cameras/${b.manufacturer}/${b.model}`}
                className="camera-card camera-card--new"
              >
                <div className="camera-card-title">{b.manufacturer} / {b.model}</div>
                <div className="camera-card-badge camera-card-badge--new">Draft</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="camera-section">
        <h3 className="camera-section-title">Published ({filteredCameras.length})</h3>
        {[...grouped.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([mfg, cams]) => (
            <div key={mfg} className="camera-manufacturer-group">
              <h4 className="camera-manufacturer-name">{mfg}</h4>
              <div className="camera-cards">
                {cams
                  .sort((a, b) => a.modelSlug.localeCompare(b.modelSlug))
                  .map((c) => (
                    <Link
                      key={`${c.manufacturerSlug}/${c.modelSlug}`}
                      to={`/cameras/${c.manufacturerSlug}/${c.modelSlug}`}
                      className="camera-card"
                    >
                      <div className="camera-card-title">{c.modelSlug}</div>
                    </Link>
                  ))}
              </div>
            </div>
          ))}
      </section>
    </div>
  );
}
