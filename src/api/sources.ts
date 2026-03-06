import { ClientCore } from "./core.ts";
import { RPCMethod } from "../rpc/methods.ts";
import type { Source, SourceFullText } from "../types.ts";
import { SourceNotFoundError, SourceAddError, SourceTimeoutError } from "../exceptions.ts";

const UPLOAD_URL = "https://notebooklm.google.com/upload/";
const CHUNK_SIZE = 64 * 1024; // 64KB chunks

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
    const raw = await this.rpc(RPCMethod.ADD_SOURCE_URL, [notebookId, url]);
    return parseSource(raw);
  }

  async addText(notebookId: string, title: string, content: string): Promise<Source> {
    const raw = await this.rpc(RPCMethod.ADD_SOURCE_TEXT, [notebookId, title, content]);
    return parseSource(raw);
  }

  async addDrive(notebookId: string, driveId: string, title: string): Promise<Source> {
    const raw = await this.rpc(RPCMethod.ADD_SOURCE_DRIVE, [notebookId, driveId, title]);
    return parseSource(raw);
  }

  async addFile(notebookId: string, filePath: string, title?: string): Promise<Source> {
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      throw new SourceAddError(`File not found: ${filePath}`);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = guessMimeType(filePath);
    const fileName = title ?? filePath.split("/").pop() ?? "upload";

    // Start upload
    const uploadToken = await this.uploadFile(
      UPLOAD_URL,
      bytes,
      mimeType,
      bytes.length,
    );

    const raw = await this.rpc(RPCMethod.ADD_SOURCE_FILE, [
      notebookId,
      uploadToken,
      fileName,
      mimeType,
    ]);
    return parseSource(raw);
  }

  async addResearch(
    notebookId: string,
    query: string,
    options: { mode?: string; from?: string; importAll?: boolean } = {},
  ): Promise<Source> {
    const raw = await this.rpc(RPCMethod.ADD_SOURCE_RESEARCH, [
      notebookId,
      query,
      options.mode ?? "standard",
      options.from ?? null,
      options.importAll ?? false,
    ]);
    return parseSource(raw);
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
}

// --- Parsers ---

function parseSource(raw: unknown): Source {
  if (!Array.isArray(raw)) {
    return { id: "", title: String(raw) };
  }
  const arr = raw as unknown[];
  return {
    id: String(arr[0] ?? ""),
    title: String(arr[1] ?? ""),
    type: (arr[2] as Source["type"]) ?? undefined,
    status: (arr[3] as Source["status"]) ?? undefined,
    url: typeof arr[4] === "string" ? arr[4] : undefined,
    createdMs: typeof arr[5] === "number" ? arr[5] : undefined,
  };
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
