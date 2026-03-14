import { describe, it, expect } from "vitest";
import { GenerateAPI } from "../../src/api/artifacts.js";
import type { RPCOptions } from "../../src/api/core.js";
import { RPCMethod } from "../../src/rpc/methods.js";

class TestArtifactsAPI extends GenerateAPI {
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

describe("Artifacts API RPC contract", () => {
  it("rename uses migrated payload", async () => {
    const api = new TestArtifactsAPI();
    api.setResponses(null, [[["art-1", "New title", 1, null, 3]]]);

    await api.rename("nb-1", "art-1", "New title");

    expect(api.calls[0]).toEqual({
      method: RPCMethod.RENAME_ARTIFACT,
      payload: [["art-1", "New title"], [["title"]]],
      options: { sourcePath: "/notebook/nb-1", allowNull: true },
    });
  });

  it("delete uses migrated payload", async () => {
    const api = new TestArtifactsAPI();
    api.setResponses(null);

    await api.delete("nb-1", "art-1");

    expect(api.calls[0]).toEqual({
      method: RPCMethod.DELETE_ARTIFACT,
      payload: [[2], "art-1"],
      options: { sourcePath: "/notebook/nb-1", allowNull: true },
    });
  });

  it("generateAudio uses CREATE_ARTIFACT", async () => {
    const api = new TestArtifactsAPI();
    api.setResponses([], [["11111111-1111-1111-1111-111111111111"]]);

    await api.generateAudio("nb-1", { sourceIds: ["src-1"], language: "en" });

    expect(api.calls[0].method).toBe(RPCMethod.LIST_ARTIFACTS);
    expect(api.calls[1].method).toBe(RPCMethod.CREATE_ARTIFACT);
    expect(api.calls[1].options).toEqual({ sourcePath: "/notebook/nb-1", allowNull: true });
    expect(api.calls[1].payload).toEqual([
      [2],
      "nb-1",
      [
        null,
        null,
        1,
        [[["src-1"]]],
        null,
        null,
        [null, [null, null, null, [["src-1"]], "en", null, null]],
      ],
    ]);
  });
});
