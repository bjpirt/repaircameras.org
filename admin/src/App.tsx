import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  Link,
} from "react-router";
import { useAuth } from "./hooks/useAuth";
import TutorialList from "./pages/TutorialList";
import TutorialEditor from "./pages/TutorialEditor";
import CameraList from "./pages/CameraList";
import CameraEditor from "./pages/CameraEditor";
import "./App.css";

function Home() {
  return (
    <div>
      <h2>Welcome</h2>
      <p>
        <Link to="/tutorials">View tutorials</Link>
      </p>
      <p>
        <Link to="/cameras">View camera pages</Link>
      </p>
    </div>
  );
}

function AuthGate() {
  const { state, login, logout } = useAuth();

  if (state.status === "idle") {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1>Contribute to Repair Cameras</h1>
          <p className="login-intro">
            Help build a free resource for anyone repairing film cameras. You
            can add new cameras, edit existing pages, or write step-by-step
            repair tutorials.
          </p>
          <div className="login-steps">
            <h2>How it works</h2>
            <ol>
              <li>
                Sign in with a free{" "}
                <a
                  href="https://github.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub account
                </a>
              </li>
              <li>Make your edits using the online editor</li>
              <li>Submit your changes for review</li>
              <li>
                A site maintainer checks everything over and your changes go
                live
              </li>
            </ol>
          </div>
          <button onClick={login} className="login-button">
            Sign in with GitHub
          </button>
          <p className="login-note">
            GitHub is free to sign up. It's used to identify contributors and
            manage edits.
          </p>
        </div>
      </div>
    );
  }

  if (state.status === "authenticating") {
    return <div className="loading">Signing in...</div>;
  }

  if (state.status === "error") {
    return (
      <div className="error-screen">
        <p>Authentication error: {state.message}</p>
        <button onClick={login}>Try again</button>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <h1>Repair Cameras Admin</h1>
        <div className="user-info">
          <img src={state.user.avatar_url} alt="" width={32} height={32} />
          <span>{state.user.login}</span>
          <button onClick={logout}>Sign out</button>
        </div>
      </header>
      <main>
        <Outlet context={state} />
      </main>
    </div>
  );
}

function HomePage() {
  return <Home />;
}

function TutorialListPage() {
  const { state } = useAuth();
  if (state.status !== "authenticated") return null;
  return <TutorialList token={state.token} username={state.user.login} />;
}

function TutorialEditorPage() {
  const { state } = useAuth();
  if (state.status !== "authenticated") return null;
  return <TutorialEditor token={state.token} username={state.user.login} />;
}

function CameraListPage() {
  const { state } = useAuth();
  if (state.status !== "authenticated") return null;
  return <CameraList token={state.token} username={state.user.login} />;
}

function CameraEditorPage() {
  const { state } = useAuth();
  if (state.status !== "authenticated") return null;
  return <CameraEditor token={state.token} username={state.user.login} />;
}

const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <AuthGate />,
      children: [
        { index: true, element: <HomePage /> },
        { path: "tutorials", element: <TutorialListPage /> },
        { path: "tutorials/:id", element: <TutorialEditorPage /> },
        { path: "cameras", element: <CameraListPage /> },
        { path: "cameras/new", element: <CameraEditorPage /> },
        { path: "cameras/:manufacturer/:model", element: <CameraEditorPage /> },
      ],
    },
  ],
  { basename: "/admin" },
);

export default function App() {
  return <RouterProvider router={router} />;
}
