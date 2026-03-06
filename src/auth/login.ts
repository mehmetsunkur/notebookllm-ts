// Playwright-based browser login for Google NotebookLM.
// Opens a Chromium browser for the user to sign in with their Google account,
// then saves the session cookies in Playwright's storage_state.json format.

import { ensureHomeDir, getStoragePath } from "../paths.ts";
import { saveStorageState } from "./storage.ts";
import { AuthError } from "../exceptions.ts";

const NOTEBOOKLM_URL = "https://notebooklm.google.com/";
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export interface LoginOptions {
  homeDir?: string;
  timeout?: number;
  headless?: boolean;
}

/**
 * Open a browser and wait for the user to log in to NotebookLM.
 * Saves the resulting session to storage_state.json.
 */
export async function login(options: LoginOptions = {}): Promise<string> {
  const { chromium } = await import("playwright");

  const homeDir = await ensureHomeDir(options.homeDir);
  const storagePath = getStoragePath(homeDir);
  const timeout = options.timeout ?? LOGIN_TIMEOUT_MS;

  console.log("Opening browser for Google NotebookLM login...");
  console.log("Please sign in with your Google account.");
  console.log(`Session will be saved to: ${storagePath}`);

  const browser = await chromium.launch({
    headless: options.headless ?? false,
    channel: "chrome",
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(NOTEBOOKLM_URL);

  // Wait for user to complete login — detect by checking for authenticated page content
  console.log("Waiting for login to complete (timeout: 5 minutes)...");

  try {
    await page.waitForFunction(
      () => {
        // Check that we're on NotebookLM and not on a Google login page
        return (
          window.location.hostname === "notebooklm.google.com" &&
          !window.location.pathname.includes("ServiceLogin") &&
          document.querySelector("[data-testid='notebook-list']") !== null ||
          document.querySelector("notebook-list") !== null ||
          document.title.toLowerCase().includes("notebooklm") &&
          !document.title.toLowerCase().includes("sign in")
        );
      },
      { timeout },
    );
  } catch {
    // Fallback: wait for URL to be on notebooklm.google.com without login path
    try {
      await page.waitForURL(
        (url) =>
          url.hostname === "notebooklm.google.com" &&
          !url.pathname.includes("signin") &&
          !url.pathname.includes("ServiceLogin"),
        { timeout },
      );
    } catch {
      await browser.close();
      throw new AuthError("Login timed out. Please try again.");
    }
  }

  // Save storage state (cookies + localStorage)
  const storageState = await context.storageState();
  await saveStorageState(storageState, storagePath);

  await browser.close();

  console.log(`Login successful! Session saved to: ${storagePath}`);
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
