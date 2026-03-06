// Extract authentication tokens from the NotebookLM homepage HTML.
// These tokens are embedded in the page's JavaScript initialization data.

import { AuthError } from "../exceptions.ts";
import type { AuthTokens } from "../types.ts";

const NOTEBOOKLM_URL = "https://notebooklm.google.com/";

// Regex patterns for token extraction (same as Python implementation)
const SNLM0E_RE = /["']SNLM0e["']\s*:\s*["']([^"']+)["']/;
const FDRFJE_RE = /["']FdrFJe["']\s*:\s*["']([^"']+)["']/;
const CFB2H_RE = /["']cfb2h["']\s*:\s*["']([^"']+)["']/;

export function extractTokensFromHtml(html: string): AuthTokens {
  const snlm0e = html.match(SNLM0E_RE)?.[1];
  const fdrfje = html.match(FDRFJE_RE)?.[1];
  const cfb2h = html.match(CFB2H_RE)?.[1];

  if (!snlm0e) {
    throw new AuthError("Could not extract SNLM0e (CSRF token) from page. Is your session valid?");
  }
  if (!fdrfje) {
    throw new AuthError("Could not extract FdrFJe (session SID) from page.");
  }
  if (!cfb2h) {
    throw new AuthError("Could not extract cfb2h (blob hash) from page.");
  }

  return { snlm0e, fdrfje, cfb2h };
}

/**
 * Fetch the NotebookLM homepage with the provided cookies and extract auth tokens.
 */
export async function fetchTokens(cookieHeader: string): Promise<AuthTokens> {
  const response = await fetch(NOTEBOOKLM_URL, {
    headers: {
      Cookie: cookieHeader,
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new AuthError(`Failed to fetch NotebookLM homepage: HTTP ${response.status}`);
  }

  const html = await response.text();

  if (html.includes("accounts.google.com") || html.includes("ServiceLogin")) {
    throw new AuthError(
      "Redirected to Google login page. Your session has expired. Run `notebooklm login` to re-authenticate.",
    );
  }

  return extractTokensFromHtml(html);
}
