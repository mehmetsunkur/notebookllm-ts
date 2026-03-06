import { ClientCore } from "./core.ts";
import { RPCMethod } from "../rpc/methods.ts";
import type { Source, SourceFullText } from "../types.ts";
import { SourceNotFoundError, SourceAddError, SourceTimeoutError } from "../exceptions.ts";

const UPLOAD_URL = "https://notebooklm.google.com/upload/";

export class SourcesAPI extends ClientCore {
  async list(notebookId: string): Promise<Source[]> {
    const raw = await this.rpc(
      RPCMethod.GET_NOTEBOOK,
      [notebookId, null, [2], null, 0],
      { sourcePath: `/notebook/${notebookId}` },
    );
    return parseSourceListFromNotebook(raw);
  }

  async get(notebookId: string, sourceId: string): Promise<Source> {
    const sources = await this.list(notebookId);
    const source = sources.find((s) => s.id === sourceId);
    if (source) return source;
    return { id: sourceId, title: "", status: "unknown" };
  }

  async addUrl(notebookId: string, url: string): Promise<Source> {
    const isYoutube = isYoutubeUrl(url);
    const payload = isYoutube
      ? [
          [[null, null, null, null, null, null, null, [url], null, null, 1]],
          notebookId,
          [2],
          [1, null, null, null, null, null, null, null, null, null, [1]],
        ]
      : [
          [[null, null, [url], null, null, null, null, null]],
          notebookId,
          [2],
          null,
          null,
        ];
    const raw = await this.rpc(RPCMethod.ADD_SOURCE, payload, {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: isYoutube,
    });
    return parseSource(raw);
  }

  async addText(notebookId: string, title: string, content: string): Promise<Source> {
    const raw = await this.rpc(
      RPCMethod.ADD_SOURCE,
      [
        [[null, [title, content], null, null, null, null, null, null]],
        notebookId,
        [2],
        null,
        null,
      ],
      { sourcePath: `/notebook/${notebookId}` },
    );
    return parseSource(raw);
  }

  async addDrive(notebookId: string, driveId: string, title: string): Promise<Source> {
    const sourceData = [
      driveId,
      "application/vnd.google-apps.document",
      1,
      title,
    ];
    const raw = await this.rpc(
      RPCMethod.ADD_SOURCE,
      [
        [sourceData],
        notebookId,
        [2],
        [1, null, null, null, null, null, null, null, null, null, [1]],
      ],
      { sourcePath: `/notebook/${notebookId}`, allowNull: true },
    );
    return parseSource(raw);
  }

  async addFile(notebookId: string, filePath: string, title?: string): Promise<Source> {
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      throw new SourceAddError(`File not found: ${filePath}`);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const fileName = title ?? filePath.split("/").pop() ?? "upload";

    const registerRaw = await this.rpc(
      RPCMethod.ADD_SOURCE_FILE,
      [
        [[fileName]],
        notebookId,
        [2],
        [1, null, null, null, null, null, null, null, null, null, [1]],
      ],
      { sourcePath: `/notebook/${notebookId}`, allowNull: true },
    );
    const sourceId = extractNestedString(registerRaw);
    if (!sourceId) {
      throw new SourceAddError(`Failed to register source for file: ${fileName}`);
    }

    const uploadUrl = await this.startResumableUpload(
      notebookId,
      fileName,
      bytes.length,
      sourceId,
    );
    await this.uploadRegisteredFile(uploadUrl, bytes);

    const source = await this.get(notebookId, sourceId);
    return { ...source, id: sourceId, title: source.title || fileName };
  }

  async addResearch(
    notebookId: string,
    query: string,
    options: { mode?: "fast" | "deep"; source?: "web" | "drive"; importAll?: boolean } = {},
  ): Promise<Source> {
    const mode = options.mode ?? "fast";
    const sourceType = options.source === "drive" ? 2 : 1;
    const rpcMethod = mode === "deep" ? RPCMethod.START_DEEP_RESEARCH : RPCMethod.START_FAST_RESEARCH;
    const startPayload =
      mode === "deep"
        ? [null, [1], [query, sourceType], 5, notebookId]
        : [[query, sourceType], null, 1, notebookId];
    await this.rpc(rpcMethod, startPayload, {
      sourcePath: `/notebook/${notebookId}`,
    });
    return {
      id: "",
      title: query,
      type: "research",
      status: "processing",
    };
  }

  async delete(notebookId: string, sourceId: string): Promise<void> {
    await this.rpc(RPCMethod.DELETE_SOURCE, [[[sourceId]]], {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: true,
    });
  }

  async rename(notebookId: string, sourceId: string, newTitle: string): Promise<Source> {
    await this.rpc(
      RPCMethod.RENAME_SOURCE,
      [null, [sourceId], [[[newTitle]]]],
      { sourcePath: `/notebook/${notebookId}`, allowNull: true },
    );
    return this.get(notebookId, sourceId);
  }

  async refresh(notebookId: string, sourceId: string): Promise<Source> {
    await this.rpc(
      RPCMethod.REFRESH_SOURCE,
      [null, [sourceId], [2]],
      { sourcePath: `/notebook/${notebookId}`, allowNull: true },
    );
    return this.get(notebookId, sourceId);
  }

  async checkFreshness(notebookId: string, sourceId: string): Promise<boolean> {
    const raw = await this.rpc(
      RPCMethod.CHECK_SOURCE_FRESHNESS,
      [null, [sourceId], [2]],
      { sourcePath: `/notebook/${notebookId}`, allowNull: true },
    );
    if (raw === true) return true;
    if (raw === false) return false;
    if (Array.isArray(raw) && raw.length === 0) return true;
    if (Array.isArray(raw) && Array.isArray(raw[0]) && raw[0][1] === true) return true;
    return false;
  }

  async fulltext(notebookId: string, sourceId: string): Promise<SourceFullText> {
    const raw = await this.rpc(
      RPCMethod.GET_SOURCE,
      [[sourceId], [2], [2]],
      { sourcePath: `/notebook/${notebookId}`, allowNull: true },
    );
    return parseSourceFullText(sourceId, raw);
  }

  async guide(notebookId: string, sourceId: string): Promise<string> {
    const raw = await this.rpc(
      RPCMethod.SOURCE_GUIDE,
      [[[[sourceId]]]],
      { sourcePath: `/notebook/${notebookId}`, allowNull: true },
    );
    if (
      Array.isArray(raw) &&
      Array.isArray(raw[0]) &&
      Array.isArray(raw[0][0]) &&
      Array.isArray(raw[0][0][1]) &&
      typeof raw[0][0][1][0] === "string"
    ) {
      return raw[0][0][1][0];
    }
    if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
    return String(raw);
  }

  async wait(
    notebookId: string,
    sourceId: string,
    options: { timeoutMs?: number; intervalMs?: number } = {},
  ): Promise<Source> {
    const timeout = options.timeoutMs ?? 5 * 60 * 1000;
    const interval = options.intervalMs ?? 3000;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const source = await this.get(notebookId, sourceId);
      if (source.status === "ready") return source;
      if (source.status === "failed") {
        throw new SourceAddError(`Source processing failed: ${sourceId}`);
      }
      await sleep(interval);
    }

    throw new SourceTimeoutError(
      `Source ${sourceId} did not finish processing within ${timeout}ms`,
    );
  }

  async findById(notebookId: string, partialId: string): Promise<Source> {
    const sources = await this.list(notebookId);
    const match = sources.find(
      (s) => s.id === partialId || s.id.startsWith(partialId),
    );
    if (!match) {
      throw new SourceNotFoundError(`No source found matching ID prefix: ${partialId}`);
    }
    return match;
  }

  private async startResumableUpload(
    notebookId: string,
    filename: string,
    fileSize: number,
    sourceId: string,
  ): Promise<string> {
    await this.ensureAuth();

    const response = await fetch(`${UPLOAD_URL}_/?authuser=0`, {
      method: "POST",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Cookie: this.getCookieHeader(),
        Origin: "https://notebooklm.google.com",
        Referer: "https://notebooklm.google.com/",
        "x-goog-authuser": "0",
        "x-goog-upload-command": "start",
        "x-goog-upload-header-content-length": String(fileSize),
        "x-goog-upload-protocol": "resumable",
      },
      body: JSON.stringify({
        PROJECT_ID: notebookId,
        SOURCE_NAME: filename,
        SOURCE_ID: sourceId,
      }),
    });

    if (!response.ok) {
      throw new SourceAddError(`Failed to start upload: HTTP ${response.status}`);
    }
    const uploadUrl = response.headers.get("x-goog-upload-url");
    if (!uploadUrl) {
      throw new SourceAddError("Missing upload URL for resumable upload");
    }
    return uploadUrl;
  }

  private async uploadRegisteredFile(uploadUrl: string, bytes: Uint8Array): Promise<void> {
    await this.ensureAuth();

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Cookie: this.getCookieHeader(),
        "x-goog-upload-command": "upload, finalize",
        "x-goog-upload-offset": "0",
        "Content-Type": "application/octet-stream",
      },
      body: bytes as unknown as BodyInit,
    });
    if (!response.ok) {
      throw new SourceAddError(`File upload failed: HTTP ${response.status}`);
    }
  }
}

// --- Parsers ---

function parseSource(raw: unknown): Source {
  if (typeof raw === "string") {
    const parsed = parseCompactSourceRow(raw);
    if (parsed) return parsed;
    return { id: "", title: raw };
  }
  if (!Array.isArray(raw)) {
    return { id: "", title: String(raw) };
  }
  const arr = raw as unknown[];
  if (Array.isArray(arr[0])) {
    return parseSource(arr[0]);
  }
  if (typeof arr[0] === "string" && arr[0].includes(",")) {
    const parsed = parseCompactSourceRow(arr[0]);
    if (parsed) return parsed;
  }
  return {
    id: String(arr[0] ?? ""),
    title: String(arr[1] ?? ""),
    type: (arr[2] as Source["type"]) ?? undefined,
    status: (arr[3] as Source["status"]) ?? undefined,
    url: typeof arr[4] === "string" ? arr[4] : undefined,
    createdMs: typeof arr[5] === "number" ? arr[5] : undefined,
  };
}

function parseCompactSourceRow(value: string): Source | null {
  const parts = value.split(",");
  if (parts.length < 2) return null;
  const id = parts[0]?.trim() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const title = parts[1]?.trim() ?? "";
  return { id, title, status: "processing" };
}

function extractNestedString(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (Array.isArray(value) && value.length > 0) {
    return extractNestedString(value[0]);
  }
  return undefined;
}

function parseSourceList(raw: unknown): Source[] {
  if (!Array.isArray(raw)) return [];
  const outer = raw as unknown[];
  const list = Array.isArray(outer[0]) ? (outer[0] as unknown[]) : outer;
  return list.filter(Array.isArray).map(parseSource);
}

function parseSourceListFromNotebook(raw: unknown): Source[] {
  if (!Array.isArray(raw) || !Array.isArray(raw[0])) return [];
  const notebookInfo = raw[0] as unknown[];
  const sources = Array.isArray(notebookInfo[1]) ? (notebookInfo[1] as unknown[]) : [];

  return sources
    .filter(Array.isArray)
    .map((src) => {
      const arr = src as unknown[];
      const id =
        Array.isArray(arr[0]) && typeof arr[0][0] === "string" ? arr[0][0] : String(arr[0] ?? "");
      const title = typeof arr[1] === "string" ? arr[1] : "";
      const typeCode = Array.isArray(arr[2]) && typeof arr[2][4] === "number" ? arr[2][4] : undefined;
      const statusCode = Array.isArray(arr[3]) && typeof arr[3][1] === "number" ? arr[3][1] : undefined;
      const url =
        Array.isArray(arr[2]) && Array.isArray(arr[2][7]) && typeof arr[2][7][0] === "string"
          ? arr[2][7][0]
          : undefined;

      return {
        id,
        title,
        type: mapSourceType(typeCode),
        status: mapSourceStatus(statusCode),
        url,
      } as Source;
    });
}

function parseSourceFullText(sourceId: string, raw: unknown): SourceFullText {
  let content = "";
  if (
    Array.isArray(raw) &&
    Array.isArray(raw[3]) &&
    Array.isArray(raw[3][0])
  ) {
    const texts = collectText(raw[3][0]);
    content = texts.join("\n");
  } else {
    content = Array.isArray(raw) ? String(raw[0] ?? "") : String(raw ?? "");
  }
  return { sourceId, content };
}

function collectText(node: unknown): string[] {
  if (!Array.isArray(node)) return [];
  const out: string[] = [];
  for (const item of node) {
    if (typeof item === "string") out.push(item);
    else out.push(...collectText(item));
  }
  return out.filter((s) => s.trim().length > 0);
}

function mapSourceStatus(statusCode: number | undefined): Source["status"] {
  if (statusCode === 1 || statusCode === 0) return "processing";
  if (statusCode === 2) return "ready";
  if (statusCode === 3 || statusCode === 4) return "failed";
  return "unknown";
}

function mapSourceType(typeCode: number | undefined): Source["type"] {
  if (typeCode === 4) return "text";
  if (typeCode === 5 || typeCode === 9) return "url";
  if (typeCode === 1 || typeCode === 2 || typeCode === 3 || typeCode === 8 || typeCode === 11 || typeCode === 13 || typeCode === 14 || typeCode === 16) return "file";
  return "file";
}

function guessMimeType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
    html: "text/html",
    htm: "text/html",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    epub: "application/epub+zip",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    wav: "audio/wav",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
  };
  return map[ext] ?? "application/octet-stream";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isYoutubeUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be)/i.test(url);
}
