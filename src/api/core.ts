// ClientCore: HTTP transport + RPC infrastructure for NotebookLM API calls.
// All API method classes extend or reference ClientCore for HTTP execution.

import { encodeRequest } from "../rpc/encoder.ts";
import { decodeResponse } from "../rpc/decoder.ts";
import { loadCookieHeader } from "../auth/storage.ts";
import { fetchTokens } from "../auth/tokens.ts";
import type { AuthTokens } from "../types.ts";
import { NetworkError, AuthError } from "../exceptions.ts";
import { rpcErrorFromStatus } from "../rpc/errors.ts";

export interface CoreOptions {
  /** Path to storage_state.json (overrides default) */
  storagePath?: string;
  /** Override home dir */
  homeDir?: string;
  /** Language tag (default: "en") */
  language?: string;
  /** Verbose logging */
  verbose?: boolean;
}

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export class ClientCore {
  private cookieHeader: string | null = null;
  private tokens: AuthTokens | null = null;
  protected language: string;
  protected verbose: boolean;
  private storagePath?: string;

  constructor(options: CoreOptions = {}) {
    this.language = options.language ?? "en";
    this.verbose = options.verbose ?? false;
    this.storagePath = options.storagePath;
  }

  /** Lazily load cookies and fetch auth tokens on first use. */
  protected async ensureAuth(): Promise<void> {
    if (this.cookieHeader && this.tokens) return;

    this.cookieHeader = await loadCookieHeader(this.storagePath);
    this.tokens = await fetchTokens(this.cookieHeader);
  }

  /** Execute a single RPC call and return the decoded result. */
  protected async rpc(method: string, payload: unknown): Promise<unknown> {
    await this.ensureAuth();

    const { url, body } = encodeRequest({
      method,
      payload,
      csrfToken: this.tokens!.snlm0e,
      sid: this.tokens!.fdrfje,
      bl: this.tokens!.cfb2h,
      hl: this.language,
    });

    if (this.verbose) {
      console.error(`[RPC] ${method} -> ${url}`);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: this.cookieHeader!,
          "User-Agent": USER_AGENT,
          Referer: "https://notebooklm.google.com/",
          "X-Same-Domain": "1",
        },
        body,
      });
    } catch (e) {
      throw new NetworkError(
        `Network error calling ${method}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    if (!response.ok) {
      throw rpcErrorFromStatus(response.status, method);
    }

    const text = await response.text();

    if (this.verbose) {
      console.error(`[RPC] ${method} response (${text.length} bytes)`);
    }

    return decodeResponse(text, method);
  }

  /**
   * Upload a file using a resumable upload URL.
   * Returns the upload token/resource URL.
   */
  protected async uploadFile(
    uploadUrl: string,
    data: Uint8Array | ReadableStream,
    contentType: string,
    totalSize: number,
  ): Promise<string> {
    await this.ensureAuth();

    // Initiate resumable upload session
    const initResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Cookie: this.cookieHeader!,
        "User-Agent": USER_AGENT,
        "Content-Type": contentType,
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(totalSize),
        "X-Goog-Upload-Header-Content-Type": contentType,
      },
      body: "",
    });

    if (!initResponse.ok) {
      throw new NetworkError(`Failed to initiate upload: HTTP ${initResponse.status}`);
    }

    const sessionUrl =
      initResponse.headers.get("X-Goog-Upload-URL") ||
      initResponse.headers.get("location") ||
      "";

    if (!sessionUrl) {
      throw new NetworkError("No upload session URL returned from server");
    }

    // Upload the data
    const uploadResponse = await fetch(sessionUrl, {
      method: "POST",
      headers: {
        Cookie: this.cookieHeader!,
        "User-Agent": USER_AGENT,
        "Content-Type": contentType,
        "X-Goog-Upload-Command": "upload, finalize",
        "X-Goog-Upload-Offset": "0",
      },
      body: data as BodyInit,
    });

    if (!uploadResponse.ok) {
      throw new NetworkError(`File upload failed: HTTP ${uploadResponse.status}`);
    }

    const uploadToken = uploadResponse.headers.get("X-Goog-Upload-URL") ?? sessionUrl;
    return uploadToken;
  }

  /** Download a binary artifact (audio, image, etc.) */
  protected async downloadBinary(url: string): Promise<Uint8Array> {
    await this.ensureAuth();

    const response = await fetch(url, {
      headers: {
        Cookie: this.cookieHeader!,
        "User-Agent": USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new NetworkError(`Download failed: HTTP ${response.status} for ${url}`);
    }

    const buf = await response.arrayBuffer();
    return new Uint8Array(buf);
  }

  /** Force re-auth on next RPC call (e.g. after token expiry). */
  public invalidateAuth(): void {
    this.cookieHeader = null;
    this.tokens = null;
  }

  /** Get the current cookie header (for direct use by subclasses). */
  protected getCookieHeader(): string {
    if (!this.cookieHeader) throw new AuthError("Not authenticated. Call ensureAuth() first.");
    return this.cookieHeader;
  }

  /** Get the current auth tokens. */
  protected getTokens(): AuthTokens {
    if (!this.tokens) throw new AuthError("Not authenticated. Call ensureAuth() first.");
    return this.tokens;
  }
}
