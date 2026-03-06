import { describe, it, expect } from "vitest";
import { NotebooksAPI } from "../../src/api/notebooks.ts";
import type { RPCOptions } from "../../src/api/core.ts";
import { RPCMethod } from "../../src/rpc/methods.ts";

class TestNotebooksAPI extends NotebooksAPI {
  calls: Array<{ method: string; payload: unknown; options: RPCOptions }> = [];
  responses: unknown[] = [];

  setResponses(...values: unknown[]): void {
    this.responses = values;
  }

  protected override async rpc(
    method: string,
    payload: unknown,
    options: RPCOptions = {},
  ): Promise<unknown> {
    this.calls.push({ method, payload, options });
    return this.responses.shift();
  }
}

describe("NotebooksAPI RPC contract", () => {
  it("create uses current method id and payload shape", async () => {
    const api = new TestNotebooksAPI();
    api.setResponses(["demo1", [], "nb-123", null, null, [null, false, null, null, null, [1772809000]]]);

    const nb = await api.create("demo1");

    expect(api.calls).toHaveLength(1);
    expect(api.calls[0]).toEqual({
      method: RPCMethod.CREATE_NOTEBOOK,
      payload: ["demo1", null, null, [2], [1]],
      options: {},
    });
    expect(nb.id).toBe("nb-123");
    expect(nb.title).toBe("demo1");
  });

  it("get uses notebook source-path and payload shape", async () => {
    const api = new TestNotebooksAPI();
    api.setResponses([["demo1", [], "nb-123", null, null, [null, false, null, null, null, [1772809000]]]]);

    const nb = await api.get("nb-123");

    expect(api.calls).toHaveLength(1);
    expect(api.calls[0]).toEqual({
      method: RPCMethod.GET_NOTEBOOK,
      payload: ["nb-123", null, [2], null, 0],
      options: { sourcePath: "/notebook/nb-123" },
    });
    expect(nb.id).toBe("nb-123");
    expect(nb.title).toBe("demo1");
  });

  it("delete uses current method id and payload shape", async () => {
    const api = new TestNotebooksAPI();
    api.setResponses(null);

    await api.delete("nb-123");

    expect(api.calls).toHaveLength(1);
    expect(api.calls[0]).toEqual({
      method: RPCMethod.DELETE_NOTEBOOK,
      payload: [["nb-123"], [2]],
      options: {},
    });
  });

  it("rename allows null response and follows up with get", async () => {
    const api = new TestNotebooksAPI();
    api.setResponses(
      null,
      [["renamed", [], "nb-123", null, null, [null, false, null, null, null, [1772809000]]]],
    );

    const nb = await api.rename("nb-123", "renamed");

    expect(api.calls).toHaveLength(2);
    expect(api.calls[0]).toEqual({
      method: RPCMethod.RENAME_NOTEBOOK,
      payload: ["nb-123", [[null, null, null, [null, "renamed"]]]],
      options: { allowNull: true, sourcePath: "/" },
    });
    expect(api.calls[1]).toEqual({
      method: RPCMethod.GET_NOTEBOOK,
      payload: ["nb-123", null, [2], null, 0],
      options: { sourcePath: "/notebook/nb-123" },
    });
    expect(nb.id).toBe("nb-123");
    expect(nb.title).toBe("renamed");
  });
});
