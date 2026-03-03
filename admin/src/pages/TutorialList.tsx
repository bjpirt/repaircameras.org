import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { Tutorial } from "@shared/types/tutorial";
import { listTutorialFiles, fetchTutorialJson, listForkBranches, type ForkBranch } from "../services/github";
import "./TutorialList.css";

interface Props {
  token: string;
  username: string;
}

interface ParsedBranch {
  type: "edit" | "new";
  tutorialId: string;
}

function parseTutorialBranch(branch: ForkBranch): ParsedBranch | null {
  if (branch.name.startsWith("tutorial/edit/")) {
    return { type: "edit", tutorialId: branch.name.slice("tutorial/edit/".length) };
  }
  if (branch.name.startsWith("tutorial/new/")) {
    return { type: "new", tutorialId: branch.name.slice("tutorial/new/".length) };
  }
  return null;
}

export default function TutorialList({ token, username }: Props) {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [editBranchIds, setEditBranchIds] = useState<Set<string>>(new Set());
  const [newBranchIds, setNewBranchIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Load published tutorials
        const files = await listTutorialFiles(token);
        const results = await Promise.all(
          files.map((f) => fetchTutorialJson(token, f.id)),
        );

        // Load fork branches for contributors
        let edits = new Set<string>();
        let news = new Set<string>();

        try {
          const branches = await listForkBranches(token, username, "tutorial/");
          for (const branch of branches) {
            const parsed = parseTutorialBranch(branch);
            if (parsed?.type === "edit") edits.add(parsed.tutorialId);
            if (parsed?.type === "new") news.add(parsed.tutorialId);
          }
        } catch {
          // Branch listing failed — not critical, just skip
        }

        if (!cancelled) {
          setTutorials(results.map((r) => r.tutorial));
          setEditBranchIds(edits);
          setNewBranchIds(news);
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
  }, [token, username]);

  if (loading) {
    return <div className="loading">Loading tutorials...</div>;
  }

  if (error) {
    return <div className="error-screen"><p>{error}</p></div>;
  }

  const publishedIds = new Set(tutorials.map((t) => t.id));
  const editsInProgress = tutorials.filter((t) => editBranchIds.has(t.id));
  const unsubmittedIds = [...newBranchIds].filter((id) => !publishedIds.has(id));

  return (
    <div className="tutorial-list">
      <div className="tutorial-list-header">
        <h2>Tutorials</h2>
        <Link to="/tutorials/new" className="btn-primary">New tutorial</Link>
      </div>

      {editsInProgress.length > 0 && (
        <section className="tutorial-section">
          <h3 className="tutorial-section-title">Edits in Progress</h3>
          <div className="tutorial-cards">
            {editsInProgress.map((t) => (
              <Link key={t.id} to={`/tutorials/${t.id}`} className="tutorial-card tutorial-card--edit">
                <div className="tutorial-card-title">{t.title}</div>
                <div className="tutorial-card-meta">
                  {t.manufacturer} {t.model}
                  {t.steps.length > 0 && <> &middot; {t.steps.length} step{t.steps.length !== 1 ? "s" : ""}</>}
                </div>
                <div className="tutorial-card-badge tutorial-card-badge--edit">Editing</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {unsubmittedIds.length > 0 && (
        <section className="tutorial-section">
          <h3 className="tutorial-section-title">Unsubmitted Tutorials</h3>
          <div className="tutorial-cards">
            {unsubmittedIds.map((id) => (
              <Link key={id} to={`/tutorials/${id}`} className="tutorial-card tutorial-card--new">
                <div className="tutorial-card-title">{id}</div>
                <div className="tutorial-card-meta">Continue editing</div>
                <div className="tutorial-card-badge tutorial-card-badge--new">Draft</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="tutorial-section">
        <h3 className="tutorial-section-title">Published</h3>
        {tutorials.length === 0 ? (
          <p className="tutorial-empty">No tutorials found in the repository.</p>
        ) : (
          <div className="tutorial-cards">
            {tutorials.map((t) => (
              <Link key={t.id} to={`/tutorials/${t.id}`} className="tutorial-card">
                <div className="tutorial-card-title">{t.title}</div>
                <div className="tutorial-card-meta">
                  {t.manufacturer} {t.model}
                  {t.steps.length > 0 && <> &middot; {t.steps.length} step{t.steps.length !== 1 ? "s" : ""}</>}
                </div>
                {t.description && (
                  <div className="tutorial-card-desc">{t.description}</div>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
