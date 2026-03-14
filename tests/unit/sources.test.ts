import { describe, it, expect } from "vitest";
import { SourcesAPI } from "../../src/api/sources.js";
import type { RPCOptions } from "../../src/api/core.js";
import { RPCMethod } from "../../src/rpc/methods.js";

class TestSourcesAPI extends SourcesAPI {
  calls: Array<{ method: string; payload: unknown; options: RPCOptions }> = [];
  responses: unknown[] = [];

  setResponses(...values: unknown[]): void {
    this.responses = values;
  }

  protected override async rpc(method: string, payload: unknown, options: RPCOptions = {}): Promise<unknown> {
    this.calls.push({ method, payload, options });
    return this.responses.shift();
  }

  protected override async ensureAuth(): Promise<void> {
    return;
  }

  protected override getCookieHeader(): string {
    return "SID=dummy";
  }
}

describe("SourcesAPI RPC contract", () => {
  it("addUrl uses unified ADD_SOURCE payload", async () => {
    const api = new TestSourcesAPI();
    api.setResponses(["src-1", "Example"]);

    await api.addUrl("nb-1", "https://example.com");

    expect(api.calls[0]).toEqual({
      method: RPCMethod.ADD_SOURCE,
      payload: [
        [[null, null, ["https://example.com"], null, null, null, null, null]],
        "nb-1",
        [2],
        null,
        null,
      ],
      options: { sourcePath: "/notebook/nb-1", allowNull: false },
    });
  });

  it("addText uses unified ADD_SOURCE payload", async () => {
    const api = new TestSourcesAPI();
    api.setResponses(["src-2", "Title"]);

    await api.addText("nb-1", "Title", "Body");

    expect(api.calls[0]).toEqual({
      method: RPCMethod.ADD_SOURCE,
      payload: [
        [[null, ["Title", "Body"], null, null, null, null, null, null]],
        "nb-1",
        [2],
        null,
        null,
      ],
      options: { sourcePath: "/notebook/nb-1" },
    });
  });

  it("addDrive uses unified ADD_SOURCE drive payload", async () => {
    const api = new TestSourcesAPI();
    api.setResponses(["src-3", "Doc"]);

    await api.addDrive("nb-1", "drive-id", "Doc");

    expect(api.calls[0]).toEqual({
      method: RPCMethod.ADD_SOURCE,
      payload: [
        [["drive-id", "application/vnd.google-apps.document", 1, "Doc"]],
        "nb-1",
        [2],
        [1, null, null, null, null, null, null, null, null, null, [1]],
      ],
      options: { sourcePath: "/notebook/nb-1", allowNull: true },
    });
  });

  it("delete keeps notebook source path and allowNull", async () => {
    const api = new TestSourcesAPI();
    api.setResponses(null);

    await api.delete("nb-1", "src-9");

    expect(api.calls[0]).toEqual({
      method: RPCMethod.DELETE_SOURCE,
      payload: [[["src-9"]]],
      options: { sourcePath: "/notebook/nb-1", allowNull: true },
    });
  });
});
