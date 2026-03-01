import { useReducer, useEffect, useCallback } from "react";
import { config } from "../config";

export type GitHubUser = {
  login: string;
  avatar_url: string;
  name: string | null;
};

export type AuthState =
  | { status: "idle" }
  | { status: "authenticating" }
  | { status: "authenticated"; token: string; user: GitHubUser }
  | { status: "error"; message: string };

type AuthAction =
  | { type: "START_AUTH" }
  | { type: "AUTH_SUCCESS"; token: string; user: GitHubUser }
  | { type: "AUTH_ERROR"; message: string }
  | { type: "LOGOUT" };

const SESSION_KEY = "rc_admin_auth";

function authReducer(_state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "START_AUTH":
      return { status: "authenticating" };
    case "AUTH_SUCCESS":
      return { status: "authenticated", token: action.token, user: action.user };
    case "AUTH_ERROR":
      return { status: "error", message: action.message };
    case "LOGOUT":
      return { status: "idle" };
  }
}

export function useAuth() {
  const [state, dispatch] = useReducer(authReducer, { status: "idle" });

  const exchangeCode = useCallback(async (code: string) => {
    dispatch({ type: "START_AUTH" });
    try {
      const tokenRes = await fetch(config.tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!tokenRes.ok) throw new Error("Token exchange failed");
      const tokenData = await tokenRes.json();
      if (tokenData.error) {
        throw new Error(tokenData.error_description ?? tokenData.error);
      }
      const accessToken: string = tokenData.access_token;

      const userRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userRes.ok) throw new Error("Failed to fetch user");
      const user: GitHubUser = await userRes.json();

      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ token: accessToken, user })
      );
      dispatch({ type: "AUTH_SUCCESS", token: accessToken, user });

      window.history.replaceState({}, "", window.location.pathname);
    } catch (err) {
      dispatch({
        type: "AUTH_ERROR",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      exchangeCode(code);
      return;
    }

    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const { token, user } = JSON.parse(stored);
        dispatch({ type: "AUTH_SUCCESS", token, user });
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
  }, [exchangeCode]);

  const login = useCallback(() => {
    const params = new URLSearchParams({
      client_id: config.githubClientId,
      redirect_uri: config.redirectUri,
      scope: "public_repo",
    });
    window.location.href = `https://github.com/login/oauth/authorize?${params}`;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    dispatch({ type: "LOGOUT" });
  }, []);

  return { state, login, logout };
}
