import { BrowserRouter, Routes, Route, Link } from "react-router";
import { useAuth } from "./hooks/useAuth";
import TutorialList from "./pages/TutorialList";
import TutorialEditor from "./pages/TutorialEditor";
import "./App.css";

function Home() {
  return (
    <div>
      <h2>Welcome</h2>
      <p><Link to="/tutorials">View tutorials</Link></p>
    </div>
  );
}

function AuthGate() {
  const { state, login, logout } = useAuth();

  if (state.status === "idle") {
    return (
      <div className="login-screen">
        <h1>Repair Cameras Admin</h1>
        <p>Sign in with GitHub to create and edit tutorials.</p>
        <button onClick={login} className="login-button">
          Sign in with GitHub
        </button>
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
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/tutorials"
            element={<TutorialList token={state.token} />}
          />
          <Route
            path="/tutorials/new"
            element={<TutorialEditor token={state.token} username={state.user.login} canPushDirectly={state.canPushDirectly} />}
          />
          <Route
            path="/tutorials/:id"
            element={<TutorialEditor token={state.token} username={state.user.login} canPushDirectly={state.canPushDirectly} />}
          />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <AuthGate />
    </BrowserRouter>
  );
}
