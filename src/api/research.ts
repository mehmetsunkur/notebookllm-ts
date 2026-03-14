import { ClientCore } from "./core.js";
import { RPCMethod } from "../rpc/methods.js";
import type { ResearchStatus, ResearchSource } from "../types.js";

export interface ResearchTask {
  taskId: string;
  reportId?: string;
  notebookId: string;
  query: string;
  mode: "fast" | "deep";
}

export class ResearchAPI extends ClientCore {
  async start(
    notebookId: string,
    query: string,
    options: { source?: "web" | "drive"; mode?: "fast" | "deep" } = {},
  ): Promise<ResearchTask | null> {
    const sourceType = options.source === "drive" ? 2 : 1;
    const mode = options.mode ?? "fast";

    const rpcMethod = mode === "deep" ? RPCMethod.START_DEEP_RESEARCH : RPCMethod.START_FAST_RESEARCH;
    const payload = mode === "deep"
      ? [null, [1], [query, sourceType], 5, notebookId]
      : [[query, sourceType], null, 1, notebookId];

    const raw = await this.rpc(rpcMethod, payload, {
      sourcePath: `/notebook/${notebookId}`,
    });

    if (!Array.isArray(raw) || raw.length === 0) return null;
    const taskId = typeof raw[0] === "string" ? raw[0] : "";
    const reportId = typeof raw[1] === "string" ? raw[1] : undefined;

    return {
      taskId,
      reportId,
      notebookId,
      query,
      mode,
    };
  }

  async poll(notebookId: string): Promise<ResearchStatus & { taskId?: string; summary?: string }> {
    const raw = await this.rpc(
      RPCMethod.POLL_RESEARCH,
      [null, null, notebookId],
      { sourcePath: `/notebook/${notebookId}` },
    );

    return parseResearchPoll(raw);
  }

  async importSources(
    notebookId: string,
    taskId: string,
    sources: Array<{ url: string; title?: string }>,
  ): Promise<Array<{ id: string; title: string }>> {
    const validSources = sources.filter((s) => typeof s.url === "string" && s.url.length > 0);
    if (validSources.length === 0) return [];

    const sourceArray = validSources.map((src) => [
      null,
      null,
      [src.url, src.title ?? "Untitled"],
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      2,
    ]);

    const raw = await this.rpc(
      RPCMethod.IMPORT_RESEARCH,
      [null, [1], taskId, notebookId, sourceArray],
      { sourcePath: `/notebook/${notebookId}` },
    );

    return parseImportedSources(raw);
  }

  async status(notebookId: string): Promise<ResearchStatus> {
    const polled = await this.poll(notebookId);
    return {
      status: polled.status,
      query: polled.query,
      sources: polled.sources,
    };
  }

  async wait(
    notebookId: string,
    options: {
      timeoutMs?: number;
      intervalMs?: number;
      importAll?: boolean;
    } = {},
  ): Promise<ResearchStatus> {
    const timeout = options.timeoutMs ?? 10 * 60 * 1000;
    const interval = options.intervalMs ?? 5000;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const status = await this.poll(notebookId);
      if (status.status === "complete" || status.status === "failed") {
        if (status.status === "complete" && options.importAll && status.taskId && status.sources?.length) {
          await this.importSources(
            notebookId,
            status.taskId,
            status.sources.map((s) => ({ url: s.url, title: s.title })),
          );
        }
        return {
          status: status.status,
          query: status.query,
          sources: status.sources,
        };
      }
      await sleep(interval);
    }

    return this.status(notebookId);
  }
}

function parseResearchPoll(raw: unknown): ResearchStatus & { taskId?: string; summary?: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { status: "idle" };
  }

  const entries = Array.isArray(raw[0]) && Array.isArray(raw[0][0])
    ? (raw[0] as unknown[])
    : (raw as unknown[]);

  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const taskId = typeof entry[0] === "string" ? entry[0] : undefined;
    const taskInfo = entry[1];
    if (!Array.isArray(taskInfo)) continue;

    const queryInfo = taskInfo[1];
    const sourcesAndSummary = taskInfo[3];
    const statusCode = taskInfo[4];

    const query = Array.isArray(queryInfo) && typeof queryInfo[0] === "string" ? queryInfo[0] : undefined;

    let summary: string | undefined;
    let parsedSources: ResearchSource[] | undefined;

    if (Array.isArray(sourcesAndSummary)) {
      const sourceData = Array.isArray(sourcesAndSummary[0]) ? (sourcesAndSummary[0] as unknown[]) : [];
      summary = typeof sourcesAndSummary[1] === "string" ? sourcesAndSummary[1] : undefined;

      parsedSources = sourceData
        .filter(Array.isArray)
        .map((src) => {
          const arr = src as unknown[];
          let url = "";
          let title = "";

          if (arr[0] == null && typeof arr[1] === "string") {
            title = arr[1];
          } else {
            url = typeof arr[0] === "string" ? arr[0] : "";
            title = typeof arr[1] === "string" ? arr[1] : "";
          }

          return {
            id: "",
            title,
            url,
            status: "ready",
          } as ResearchSource;
        })
        .filter((s) => s.title.length > 0 || s.url.length > 0);
    }

    return {
      taskId,
      status: statusCode === 2 ? "complete" : "running",
      query,
      sources: parsedSources,
      summary,
    };
  }

  return { status: "idle" };
}

function parseImportedSources(raw: unknown): Array<{ id: string; title: string }> {
  if (!Array.isArray(raw)) return [];

  const entries =
    Array.isArray(raw[0]) && Array.isArray(raw[0][0])
      ? (raw[0] as unknown[])
      : (raw as unknown[]);

  return entries
    .filter(Array.isArray)
    .map((entry) => {
      const arr = entry as unknown[];
      const id = Array.isArray(arr[0]) && typeof arr[0][0] === "string" ? arr[0][0] : "";
      const title = typeof arr[1] === "string" ? arr[1] : "";
      return { id, title };
    })
    .filter((s) => s.id.length > 0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
