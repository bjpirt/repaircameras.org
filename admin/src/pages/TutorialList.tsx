import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { Tutorial } from "@shared/types/tutorial";
import { listTutorialFiles, fetchTutorialJson } from "../services/github";

interface Props {
  token: string;
}

export default function TutorialList({ token }: Props) {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const files = await listTutorialFiles(token);
        const results = await Promise.all(
          files.map((f) => fetchTutorialJson(token, f.id)),
        );
        if (!cancelled) {
          setTutorials(results.map((r) => r.tutorial));
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load tutorials");
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return <div className="loading">Loading tutorials...</div>;
  }

  if (error) {
    return <div className="error-screen"><p>{error}</p></div>;
  }

  if (tutorials.length === 0) {
    return <p>No tutorials found in the repository.</p>;
  }

  return (
    <div className="tutorial-list">
      <div className="tutorial-list-header">
        <h2>Tutorials</h2>
        <Link to="/tutorials/new" className="btn-primary">New tutorial</Link>
      </div>
      <ul>
        {tutorials.map((t) => (
          <li key={t.id} className="tutorial-list-item">
            <Link to={`/tutorials/${t.id}`}>
              <strong>{t.title}</strong>
              <span className="tutorial-meta">
                {t.manufacturer} {t.model}
              </span>
              <span className="tutorial-desc">{t.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
