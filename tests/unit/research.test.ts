import { describe, it, expect } from "vitest";
import { ResearchAPI } from "../../src/api/research.ts";
import type { RPCOptions } from "../../src/api/core.ts";
import { RPCMethod } from "../../src/rpc/methods.ts";

class TestResearchAPI extends ResearchAPI {
  calls: Array<{ method: string; payload: unknown; options: RPCOptions }> = [];
  responses: unknown[] = [];

  setResponses(...values: unknown[]): void {
    this.responses = values;
  }

  protected override async rpc(method: string, payload: unknown, options: RPCOptions = {}): Promise<unknown> {
    this.calls.push({ method, payload, options });
    return this.responses.shift();
  }
}

describe("ResearchAPI RPC contract", () => {
  it("start fast uses Ljjv0c payload", async () => {
    const api = new TestResearchAPI();
    api.setResponses(["task-1", "report-1"]);

    await api.start("nb-1", "query", { mode: "fast", source: "web" });

    expect(api.calls[0]).toEqual({
      method: RPCMethod.START_FAST_RESEARCH,
      payload: [["query", 1], null, 1, "nb-1"],
      options: { sourcePath: "/notebook/nb-1" },
    });
  });

  it("poll uses e3bVqc payload", async () => {
    const api = new TestResearchAPI();
    api.setResponses([]);

    await api.poll("nb-1");

    expect(api.calls[0]).toEqual({
      method: RPCMethod.POLL_RESEARCH,
      payload: [null, null, "nb-1"],
      options: { sourcePath: "/notebook/nb-1" },
    });
  });

  it("import uses LBwxtb payload", async () => {
    const api = new TestResearchAPI();
    api.setResponses([]);

    await api.importSources("nb-1", "task-1", [{ url: "https://x.com", title: "X" }]);

    expect(api.calls[0].method).toBe(RPCMethod.IMPORT_RESEARCH);
    expect(api.calls[0].options).toEqual({ sourcePath: "/notebook/nb-1" });
  });
});
