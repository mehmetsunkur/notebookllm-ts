// Load auth state from storage_state.json (Playwright format).
// Supports both file-based storage and inline JSON via env var.

import { ConfigurationError, AuthError } from "../exceptions.ts";
import type { StorageState, CookieEntry } from "../types.ts";
import { getStoragePath } from "../paths.ts";

const AUTH_JSON_ENV = "NOTEBOOKLLM_TS_AUTH_JSON";

/**
 * Build a Cookie header string from an array of cookie entries.
 * Only includes cookies relevant to notebooklm.google.com.
 */
export function buildCookieHeader(cookies: CookieEntry[]): string {
  const relevant = cookies.filter(
    (c) =>
      c.domain.includes("google.com") ||
      c.domain.includes("notebooklm") ||
      c.domain === ".google.com",
  );
  return relevant.map((c) => `${c.name}=${c.value}`).join("; ");
}

/**
 * Load StorageState from a file path.
 */
export async function loadStorageFromFile(filePath: string): Promise<StorageState> {
  const file = Bun.file(filePath);
  const exists = await file.exists();
  if (!exists) {
    throw new ConfigurationError(
      `Auth storage file not found: ${filePath}\nRun \`notebooklm login\` to authenticate.`,
    );
  }

  try {
    const text = await file.text();
    return JSON.parse(text) as StorageState;
  } catch (e) {
    throw new ConfigurationError(
      `Failed to parse auth storage file ${filePath}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/**
 * Load StorageState from the NOTEBOOKLLM_TS_AUTH_JSON env var (inline JSON).
 */
export function loadStorageFromEnv(): StorageState | null {
  const raw = process.env[AUTH_JSON_ENV];
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StorageState;
  } catch (e) {
    throw new ConfigurationError(
      `Failed to parse ${AUTH_JSON_ENV} env var: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/**
 * Load cookies from storage — tries env var first, then file.
 * Returns a Cookie header string.
 */
export async function loadCookieHeader(storagePath?: string): Promise<string> {
  const state = loadStorageFromEnv() ?? (await loadStorageFromFile(storagePath ?? getStoragePath()));

  if (!state.cookies || state.cookies.length === 0) {
    throw new AuthError("No cookies found in storage state. Run `notebooklm login` to authenticate.");
  }

  return buildCookieHeader(state.cookies);
}

/**
 * Load the raw StorageState object — tries env var first, then file.
 */
export async function loadAuthFromStorage(storagePath?: string): Promise<StorageState> {
  return loadStorageFromEnv() ?? (await loadStorageFromFile(storagePath ?? getStoragePath()));
}

/**
 * Save a StorageState to file.
 */
export async function saveStorageState(state: StorageState, filePath: string): Promise<void> {
  await Bun.write(filePath, JSON.stringify(state, null, 2));
}
