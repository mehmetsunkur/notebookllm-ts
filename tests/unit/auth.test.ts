import { describe, it, expect } from "vitest";
import { extractTokensFromHtml } from "../../src/auth/tokens.js";
import { buildCookieHeader } from "../../src/auth/storage.js";
import { AuthError } from "../../src/exceptions.js";
import type { CookieEntry } from "../../src/types.js";

describe("extractTokensFromHtml", () => {
  function makeHtml(snlm0e: string, fdrfje: string, cfb2h: string): string {
    return `
      <script>
        window.WIZ_global_data = {
          "SNlM0e": "${snlm0e}",
          "FdrFJe": "${fdrfje}",
          "cfb2h": "${cfb2h}",
          "other": "value"
        };
      </script>
    `;
  }

  it("extracts all three tokens from HTML", () => {
    const html = makeHtml("csrf123", "sid456", "bl789");
    const tokens = extractTokensFromHtml(html);
    expect(tokens.snlm0e).toBe("csrf123");
    expect(tokens.fdrfje).toBe("sid456");
    expect(tokens.cfb2h).toBe("bl789");
  });

  it("throws AuthError if SNlM0e is missing", () => {
    const html = `
      <script>{"FdrFJe": "sid", "cfb2h": "bl"}</script>
    `;
    expect(() => extractTokensFromHtml(html)).toThrow(AuthError);
    expect(() => extractTokensFromHtml(html)).toThrow(/SNlM0e/);
  });

  it("throws AuthError if FdrFJe is missing", () => {
    const html = `
      <script>{"SNlM0e": "csrf", "cfb2h": "bl"}</script>
    `;
    expect(() => extractTokensFromHtml(html)).toThrow(AuthError);
    expect(() => extractTokensFromHtml(html)).toThrow(/FdrFJe/);
  });

  it("throws AuthError if cfb2h is missing", () => {
    const html = `
      <script>{"SNlM0e": "csrf", "FdrFJe": "sid"}</script>
    `;
    expect(() => extractTokensFromHtml(html)).toThrow(AuthError);
    expect(() => extractTokensFromHtml(html)).toThrow(/cfb2h/);
  });

  it("handles single-quoted tokens", () => {
    const html = `var d={'SNlM0e':'csrf_val','FdrFJe':'sid_val','cfb2h':'bl_val'};`;
    const tokens = extractTokensFromHtml(html);
    expect(tokens.snlm0e).toBe("csrf_val");
    expect(tokens.fdrfje).toBe("sid_val");
    expect(tokens.cfb2h).toBe("bl_val");
  });

  it("handles tokens with special characters", () => {
    const html = makeHtml("AbCdEfGh1234567890==", "1234567890abcdef", "hashval123");
    const tokens = extractTokensFromHtml(html);
    expect(tokens.snlm0e).toBe("AbCdEfGh1234567890==");
  });
});

describe("buildCookieHeader", () => {
  const cookies: CookieEntry[] = [
    { name: "SID", value: "sid_value", domain: ".google.com", path: "/" },
    { name: "HSID", value: "hsid_value", domain: ".google.com", path: "/" },
    { name: "__Secure-1PSID", value: "psid_value", domain: ".google.com", path: "/" },
    { name: "other_cookie", value: "other", domain: "example.com", path: "/" },
    { name: "notebooklm_sess", value: "sess_val", domain: "notebooklm.google.com", path: "/" },
  ];

  it("includes google.com and notebooklm cookies", () => {
    const header = buildCookieHeader(cookies);
    expect(header).toContain("SID=sid_value");
    expect(header).toContain("HSID=hsid_value");
    expect(header).toContain("notebooklm_sess=sess_val");
  });

  it("excludes non-google cookies", () => {
    const header = buildCookieHeader(cookies);
    expect(header).not.toContain("other_cookie=other");
  });

  it("formats as semicolon-separated name=value pairs", () => {
    const header = buildCookieHeader(cookies);
    const pairs = header.split("; ");
    for (const pair of pairs) {
      expect(pair).toMatch(/^[^=]+=.+$/);
    }
  });

  it("returns empty string for no matching cookies", () => {
    const noCookies: CookieEntry[] = [
      { name: "foo", value: "bar", domain: "example.com", path: "/" },
    ];
    const header = buildCookieHeader(noCookies);
    expect(header).toBe("");
  });

  it("returns empty string for empty array", () => {
    expect(buildCookieHeader([])).toBe("");
  });
});
