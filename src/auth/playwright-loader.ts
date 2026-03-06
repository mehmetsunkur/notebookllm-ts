/**
 * Playwright loader for compiled binary distribution.
 *
 * bun build --compile embeds the build machine's absolute paths for any
 * require.resolve() calls inside bundled packages. Playwright uses this
 * internally to locate its own package.json and browser executables, so
 * bundling it breaks on any machine other than the build machine.
 *
 * Solution: mark playwright as --external in the build, auto-install it to
 * ~/.notebookllm-ts/node_modules/ on first login, and load it from there
 * using createRequire so Node's module resolution starts from our managed dir.
 */

import path from "path";
import { existsSync } from "fs";
import { createRequire } from "module";
import { execSync } from "child_process";

// Match the version in package.json
const PLAYWRIGHT_VERSION = "1.50.1";

export async function loadPlaywright(homeDir: string): Promise<typeof import("playwright")> {
  const playwrightDir = path.join(homeDir, "node_modules", "playwright");

  if (!existsSync(playwrightDir)) {
    await installPlaywright(homeDir);
  }

  // createRequire with a file inside homeDir causes Node to resolve
  // 'playwright' from homeDir/node_modules/ — works in compiled binaries.
  const req = createRequire(path.join(homeDir, "_loader.js"));
  return req("playwright");
}

async function installPlaywright(homeDir: string): Promise<void> {
  console.log(`Playwright not found. Installing to: ${homeDir}`);
  console.log("(One-time setup, ~50 MB)\n");

  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

  try {
    execSync(
      `${npmCmd} install playwright@${PLAYWRIGHT_VERSION} --prefix "${homeDir}" --no-save --loglevel=warn`,
      { stdio: "inherit" },
    );
  } catch {
    throw new Error(
      `Failed to auto-install Playwright.\n` +
        `Install manually and re-run login:\n\n` +
        `  npm install playwright@${PLAYWRIGHT_VERSION} --prefix "${homeDir}"\n` +
        `  npx playwright install chromium`,
    );
  }

  // Also install the chromium browser for this playwright version
  const playwrightBin = path.join(
    homeDir,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "playwright.cmd" : "playwright",
  );

  console.log("\nInstalling Chromium browser...");
  try {
    execSync(`"${playwrightBin}" install chromium`, { stdio: "inherit" });
  } catch {
    console.warn(
      "Warning: Chromium auto-install failed. Run manually:\n" +
        `  npx playwright@${PLAYWRIGHT_VERSION} install chromium`,
    );
  }

  console.log("");
}
