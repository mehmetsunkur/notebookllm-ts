// Playwright-based browser login for Google NotebookLM.
// Opens a Chromium browser for the user to sign in with their Google account,
// then saves the session cookies in Playwright's storage_state.json format.

import { ensureHomeDir, getBrowserProfileDir, getStoragePath } from "../paths.ts";
import { loadPlaywright } from "./playwright-loader.ts";
import { mkdir } from "fs/promises";

const NOTEBOOKLM_URL = "https://notebooklm.google.com/";

export interface LoginOptions {
  homeDir?: string;
  timeout?: number;
  headless?: boolean;
}

/**
 * Open a browser and wait for the user to log in to NotebookLM.
 * Uses a persistent browser profile to avoid Google's bot detection.
 * Saves the resulting session to storage_state.json.
 */
export async function login(options: LoginOptions = {}): Promise<string> {
  const homeDir = await ensureHomeDir(options.homeDir);
  const { chromium } = await loadPlaywright(homeDir);
  const storagePath = getStoragePath(homeDir);
  const browserProfileDir = getBrowserProfileDir(homeDir);

  // Ensure browser profile directory exists
  await mkdir(browserProfileDir, { recursive: true });

  console.log("Opening browser for Google NotebookLM login...");
  console.log("Please sign in with your Google account.");
  console.log(`Session will be saved to: ${storagePath}`);
  console.log(`Using persistent profile: ${browserProfileDir}`);

  // Use a persistent context with anti-detection args — mirrors notebooklm-py approach.
  // Google blocks headless/automated browsers via navigator.webdriver and the
  // AutomationControlled Blink feature. These flags suppress those signals.
  const context = await chromium.launchPersistentContext(browserProfileDir, {
    headless: options.headless ?? false,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--password-store=basic",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  });

  const page = context.pages()[0] ?? await context.newPage();
  await page.goto(NOTEBOOKLM_URL);

  console.log("\nInstructions:");
  console.log("  1. Complete the Google login in the browser window");
  console.log("  2. Wait until you see the NotebookLM homepage");
  console.log("  3. Press ENTER here to save and close\n");

  // Wait for user to confirm login interactively (same UX as Python version)
  await new Promise<void>((resolve) => {
    process.stdout.write("[Press ENTER when logged in] ");
    process.stdin.once("data", () => {
      process.stdin.unref();
      resolve();
    });
  });

  const currentUrl = page.url();
  if (!currentUrl.includes("notebooklm.google.com")) {
    console.warn(`Warning: Current URL is ${currentUrl}`);
  }

  // Save storage state (cookies + localStorage)
  await context.storageState({ path: storagePath });
  await context.close();

  console.log(`\nLogin successful! Session saved to: ${storagePath}`);
  return storagePath;
}

/**
 * Check whether a valid storage_state.json exists and is non-empty.
 */
export async function hasValidStorage(storagePath: string): Promise<boolean> {
  const file = Bun.file(storagePath);
  if (!(await file.exists())) return false;
  try {
    const state = JSON.parse(await file.text());
    return Array.isArray(state.cookies) && state.cookies.length > 0;
  } catch {
    return false;
  }
}
