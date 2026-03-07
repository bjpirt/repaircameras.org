const isDev = import.meta.env.DEV;

export const config = {
  githubClientId: import.meta.env.VITE_GITHUB_CLIENT_ID ?? "",
  tokenEndpoint: isDev
    ? "http://localhost:8788/token"
    : "https://repaircameras.org/auth/token",
  redirectUri: isDev
    ? "http://localhost:5173/admin/"
    : "https://repaircameras.org/admin/",
  repoOwner: "bjpirt",
  repoName: "repaircameras.org",
  repoBranch: import.meta.env.VITE_REPO_BRANCH ?? "main",
} as const;
