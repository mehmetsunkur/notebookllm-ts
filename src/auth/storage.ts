// Load auth state from storage_state.json (Playwright format).
// Supports both file-based storage and inline JSON via env var.

import { ConfigurationError, AuthError } from "../exceptions.js";
import type { StorageState, CookieEntry } from "../types.js";
import { getStoragePath } from "../paths.js";

const AUTH_JSON_ENV = "NOTEBOOKLLM_TS_AUTH_JSON";

const ALLOWED_COOKIE_DOMAINS = new Set<string>([
  ".google.com",
  "notebooklm.google.com",
  ".googleusercontent.com",
]);

const GOOGLE_REGIONAL_CCTLDS = new Set<string>([
  "com.sg",
  "com.au",
  "com.br",
  "com.mx",
  "com.ar",
  "com.hk",
  "com.tw",
  "com.my",
  "com.ph",
  "com.vn",
  "com.pk",
  "com.bd",
  "com.ng",
  "com.eg",
  "com.tr",
  "com.ua",
  "com.co",
  "com.pe",
  "com.sa",
  "com.ae",
  "co.uk",
  "co.jp",
  "co.in",
  "co.kr",
  "co.za",
  "co.nz",
  "co.id",
  "co.th",
  "co.il",
  "co.ve",
  "co.cr",
  "co.ke",
  "co.ug",
  "co.tz",
  "co.ma",
  "co.ao",
  "co.mz",
  "co.zw",
  "co.bw",
  "cn",
  "de",
  "fr",
  "it",
  "es",
  "nl",
  "pl",
  "ru",
  "ca",
  "be",
  "at",
  "ch",
  "se",
  "no",
  "dk",
  "fi",
  "pt",
  "gr",
  "cz",
  "ro",
  "hu",
  "ie",
  "sk",
  "bg",
  "hr",
  "si",
  "lt",
  "lv",
  "ee",
  "lu",
  "cl",
  "cat",
]);

function isGoogleDomain(domain: string): boolean {
  if (domain === ".google.com") return true;
  if (!domain.startsWith(".google.")) return false;
  return GOOGLE_REGIONAL_CCTLDS.has(domain.slice(".google.".length));
}

function isAllowedAuthDomain(domain: string): boolean {
  return ALLOWED_COOKIE_DOMAINS.has(domain) || isGoogleDomain(domain);
}

/**
 * Build a Cookie header string from an array of cookie entries.
 * Deduplicates by cookie name and prefers .google.com values.
 */
export function buildCookieHeader(cookies: CookieEntry[]): string {
  const deduped = new Map<string, string>();
  const sourceDomain = new Map<string, string>();

  for (const cookie of cookies) {
    const name = cookie.name;
    const domain = cookie.domain ?? "";
    if (!name || !isAllowedAuthDomain(domain)) continue;

    const existingDomain = sourceDomain.get(name);
    const useCookie = !existingDomain || domain === ".google.com";
    if (useCookie) {
      deduped.set(name, cookie.value);
      sourceDomain.set(name, domain);
    }
  }

  return Array.from(deduped.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

/**
 * Load StorageState from a file path.
 */
export async function loadStorageFromFile(filePath: string): Promise<StorageState> {
  const { readFile, access } = await import("fs/promises");
  const exists = await access(filePath).then(() => true).catch(() => false);
  if (!exists) {
    throw new ConfigurationError(
      `Auth storage file not found: ${filePath}\nRun \`notebooklm login\` to authenticate.`,
    );
  }

  try {
    const text = await readFile(filePath, "utf-8");
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

  const cookieHeader = buildCookieHeader(state.cookies);
  if (!cookieHeader) {
    throw new AuthError("No valid Google auth cookies found. Run `notebooklm login` to authenticate.");
  }
  return cookieHeader;
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
  const { writeFile } = await import("fs/promises");
  await writeFile(filePath, JSON.stringify(state, null, 2));
}
