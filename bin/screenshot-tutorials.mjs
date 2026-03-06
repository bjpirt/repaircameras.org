import { chromium } from "playwright";
import { spawn } from "child_process";
import { mkdirSync } from "fs";

const tutorials = process.env.TUTORIALS?.split("\n").filter(Boolean);
if (!tutorials || tutorials.length === 0) {
  console.log("No tutorials to screenshot");
  process.exit(0);
}

const server = spawn("npx", ["serve", "_site", "-l", "8080", "--no-clipboard"], {
  stdio: "ignore",
});

// Wait for server to be ready
await new Promise((r) => setTimeout(r, 3000));

try {
  const browser = await chromium.launch();
  mkdirSync("screenshots", { recursive: true });

  for (const id of tutorials) {
    console.log(`Screenshotting: ${id}`);
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`http://localhost:8080/tutorials/${id}/`, { waitUntil: "networkidle" });
    await page.screenshot({ path: `screenshots/${id}.png`, fullPage: true });
    await page.close();
  }

  await browser.close();
} finally {
  server.kill();
}
