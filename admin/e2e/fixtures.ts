import { test as base, expect } from "@playwright/test";

export { expect };

const SESSION_KEY = "rc_admin_auth";

const FAKE_AUTH = {
  token: "test-token",
  user: {
    login: "test-user",
    avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
    name: "Test User",
  },
  canPushDirectly: false,
};

/**
 * Extended test fixture that pre-injects GitHub auth into sessionStorage
 * before React mounts, bypassing the OAuth flow entirely.
 *
 * Also registers a catch-all handler that blocks unmocked GitHub API calls
 * so tests fail loudly when they hit an unexpected endpoint.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Inject auth before any page scripts run
    await page.addInitScript(({ key, auth }) => {
      sessionStorage.setItem(key, JSON.stringify(auth));
    }, { key: SESSION_KEY, auth: FAKE_AUTH });

    // Catch-all: any unhandled GitHub API call returns 500 and logs
    await page.route("https://api.github.com/**", (route) => {
      console.error(`[E2E] Unhandled GitHub API call: ${route.request().method()} ${route.request().url()}`);
      route.fulfill({ status: 500, body: '{"message":"Unhandled test route"}' });
    });

    await use(page);
  },
});
