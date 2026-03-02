import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAuth } from "./useAuth";

vi.mock("../config", () => ({
  config: {
    githubClientId: "test-client-id",
    tokenEndpoint: "http://localhost:8788/token",
    redirectUri: "http://localhost:5173/admin/",
    repoOwner: "test-owner",
    repoName: "test-repo",
    repoBranch: "main",
  },
}));

vi.mock("../services/github", () => ({
  checkPushAccess: vi.fn().mockResolvedValue(true),
}));

import { checkPushAccess } from "../services/github";

const mockUser = { login: "testuser", avatar_url: "https://example.com/avatar.png", name: "Test User" };

function mockFetchResponses(tokenResponse: Response, userResponse?: Response) {
  const fn = vi.fn();
  fn.mockResolvedValueOnce(tokenResponse);
  if (userResponse) fn.mockResolvedValueOnce(userResponse);
  vi.stubGlobal("fetch", fn);
  return fn;
}

function jsonResponse(data: unknown, ok = true): Response {
  return { ok, json: () => Promise.resolve(data) } as Response;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(checkPushAccess).mockResolvedValue(true);
  sessionStorage.clear();
  window.history.replaceState({}, "", "/admin/");
});

describe("useAuth", () => {
  it("starts in idle state", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.state.status).toBe("idle");
  });

  it("exchanges code from URL and transitions to authenticated", async () => {
    window.history.replaceState({}, "", "/admin/?code=test-code-123");
    mockFetchResponses(
      jsonResponse({ access_token: "tok-abc" }),
      jsonResponse(mockUser)
    );

    const { result } = renderHook(() => useAuth());
    expect(result.current.state.status).toBe("authenticating");

    await waitFor(() => {
      expect(result.current.state.status).toBe("authenticated");
    });

    if (result.current.state.status === "authenticated") {
      expect(result.current.state.user.login).toBe("testuser");
      expect(result.current.state.token).toBe("tok-abc");
      expect(result.current.state.canPushDirectly).toBe(true);
    }
    expect(sessionStorage.getItem("rc_admin_auth")).toBeTruthy();
    expect(window.location.search).toBe("");
  });

  it("sets canPushDirectly to false for contributors", async () => {
    window.history.replaceState({}, "", "/admin/?code=test-code");
    vi.mocked(checkPushAccess).mockResolvedValueOnce(false);
    mockFetchResponses(
      jsonResponse({ access_token: "tok-contrib" }),
      jsonResponse(mockUser)
    );

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.state.status).toBe("authenticated");
    });

    if (result.current.state.status === "authenticated") {
      expect(result.current.state.canPushDirectly).toBe(false);
    }

    const stored = JSON.parse(sessionStorage.getItem("rc_admin_auth")!);
    expect(stored.canPushDirectly).toBe(false);
  });

  it("transitions to error on token exchange failure", async () => {
    window.history.replaceState({}, "", "/admin/?code=bad-code");
    mockFetchResponses(jsonResponse(null, false));

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.state.status).toBe("error");
    });

    if (result.current.state.status === "error") {
      expect(result.current.state.message).toBe("Token exchange failed");
    }
  });

  it("transitions to error when GitHub returns an error in the token response", async () => {
    window.history.replaceState({}, "", "/admin/?code=expired-code");
    mockFetchResponses(
      jsonResponse({ error: "bad_verification_code", error_description: "The code has expired" })
    );

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.state.status).toBe("error");
    });

    if (result.current.state.status === "error") {
      expect(result.current.state.message).toBe("The code has expired");
    }
  });

  it("transitions to error on user fetch failure", async () => {
    window.history.replaceState({}, "", "/admin/?code=test-code");
    mockFetchResponses(
      jsonResponse({ access_token: "tok-abc" }),
      jsonResponse(null, false)
    );

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.state.status).toBe("error");
    });

    if (result.current.state.status === "error") {
      expect(result.current.state.message).toBe("Failed to fetch user");
    }
  });

  it("restores session from sessionStorage with canPushDirectly", async () => {
    sessionStorage.setItem(
      "rc_admin_auth",
      JSON.stringify({ token: "stored-tok", user: mockUser, canPushDirectly: true })
    );

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.state.status).toBe("authenticated");
    });

    if (result.current.state.status === "authenticated") {
      expect(result.current.state.token).toBe("stored-tok");
      expect(result.current.state.user.login).toBe("testuser");
      expect(result.current.state.canPushDirectly).toBe(true);
    }
  });

  it("defaults canPushDirectly to false for old session data", async () => {
    sessionStorage.setItem(
      "rc_admin_auth",
      JSON.stringify({ token: "stored-tok", user: mockUser })
    );

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.state.status).toBe("authenticated");
    });

    if (result.current.state.status === "authenticated") {
      expect(result.current.state.canPushDirectly).toBe(false);
    }
  });

  it("clears session and returns to idle on logout", async () => {
    sessionStorage.setItem(
      "rc_admin_auth",
      JSON.stringify({ token: "tok", user: mockUser, canPushDirectly: true })
    );

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.state.status).toBe("authenticated");
    });

    act(() => result.current.logout());

    expect(result.current.state.status).toBe("idle");
    expect(sessionStorage.getItem("rc_admin_auth")).toBeNull();
  });

  it("login redirects to GitHub OAuth", () => {
    const hrefSetter = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, search: "", pathname: "/admin/" },
      writable: true,
    });
    Object.defineProperty(window.location, "href", { set: hrefSetter, configurable: true });

    const { result } = renderHook(() => useAuth());
    result.current.login();

    expect(hrefSetter).toHaveBeenCalledWith(
      expect.stringContaining("https://github.com/login/oauth/authorize")
    );
    expect(hrefSetter).toHaveBeenCalledWith(
      expect.stringContaining("client_id=test-client-id")
    );
  });
});
