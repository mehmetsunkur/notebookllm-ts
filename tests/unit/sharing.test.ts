import { describe, it, expect } from "vitest";
import { SharingAPI } from "../../src/api/sharing.js";
import type { RPCOptions } from "../../src/api/core.js";
import { RPCMethod } from "../../src/rpc/methods.js";

class TestSharingAPI extends SharingAPI {
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

describe("SharingAPI RPC contract", () => {
  it("setPublic uses SHARE_NOTEBOOK then status", async () => {
    const api = new TestSharingAPI();
    api.setResponses(null, [[[], [true]]]);

    await api.setPublic("nb-1", true);

    expect(api.calls[0]).toEqual({
      method: RPCMethod.SHARE_NOTEBOOK,
      payload: [[["nb-1", null, [1], [1, ""]]], 1, null, [2]],
      options: { sourcePath: "/notebook/nb-1", allowNull: true },
    });
    expect(api.calls[1].method).toBe(RPCMethod.SHARE_STATUS);
  });

  it("setViewLevel uses RENAME_NOTEBOOK payload variant", async () => {
    const api = new TestSharingAPI();
    api.setResponses(null, [[[], [false]]]);

    await api.setViewLevel("nb-1", "view");

    expect(api.calls[0]).toEqual({
      method: RPCMethod.RENAME_NOTEBOOK,
      payload: ["nb-1", [[null, null, null, null, null, null, null, null, [[0]]]]],
      options: { sourcePath: "/notebook/nb-1", allowNull: true },
    });
  });
});
