import { ClientCore } from "./core.ts";
import { RPCMethod } from "../rpc/methods.ts";
import type { ResearchStatus, ResearchSource } from "../types.ts";

export class ResearchAPI extends ClientCore {
  async status(notebookId: string): Promise<ResearchStatus> {
    const raw = await this.rpc(RPCMethod.RESEARCH_STATUS, [notebookId]);
    return parseResearchStatus(raw);
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
      const status = await this.status(notebookId);
      if (status.status === "complete" || status.status === "failed") {
        return status;
      }
      await sleep(interval);
    }

    return this.status(notebookId);
  }
}

// --- Parsers ---

function parseResearchStatus(raw: unknown): ResearchStatus {
  if (!Array.isArray(raw)) {
    return { status: "idle" };
  }
  const arr = raw as unknown[];
  const statusStr = String(arr[0] ?? "idle") as ResearchStatus["status"];
  const query = typeof arr[1] === "string" ? arr[1] : undefined;

  const sources = Array.isArray(arr[2])
    ? (arr[2] as unknown[]).filter(Array.isArray).map((s) => {
        const sarr = s as unknown[];
        return {
          id: String(sarr[0] ?? ""),
          title: String(sarr[1] ?? ""),
          url: String(sarr[2] ?? ""),
          status: (sarr[3] as ResearchSource["status"]) ?? "pending",
          summary: typeof sarr[4] === "string" ? sarr[4] : undefined,
        };
      })
    : undefined;

  return { status: statusStr, query, sources };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
