import { describe, it, expect } from "vitest";
import { ChatAPI } from "../../src/api/chat.ts";
import type { RPCOptions } from "../../src/api/core.ts";
import { RPCMethod } from "../../src/rpc/methods.ts";

class TestChatAPI extends ChatAPI {
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

describe("Chat API RPC contract", () => {
  it("history fetches last conversation then turns", async () => {
    const api = new TestChatAPI();
    api.setResponses([[["conv-1"]]], [[[]]]);

    await api.history("nb-1");

    expect(api.calls[0]).toEqual({
      method: RPCMethod.GET_LAST_CONVERSATION_ID,
      payload: [[], null, "nb-1", 1],
      options: { sourcePath: "/notebook/nb-1" },
    });
    expect(api.calls[1]).toEqual({
      method: RPCMethod.GET_CONVERSATION_TURNS,
      payload: [[], null, null, "conv-1", 100],
      options: { sourcePath: "/notebook/nb-1" },
    });
  });

  it("configure uses RENAME_NOTEBOOK payload variant", async () => {
    const api = new TestChatAPI();
    api.setResponses(null);

    await api.configure("nb-1", "detailed");

    expect(api.calls[0]).toEqual({
      method: RPCMethod.RENAME_NOTEBOOK,
      payload: ["nb-1", [[null, null, null, null, null, null, null, [[1], [4]]]]],
      options: { sourcePath: "/notebook/nb-1", allowNull: true },
    });
  });
});
