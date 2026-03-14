import { describe, it, expect } from "vitest";
import { NotesAPI } from "../../src/api/notes.js";
import type { RPCOptions } from "../../src/api/core.js";
import { RPCMethod } from "../../src/rpc/methods.js";

class TestNotesAPI extends NotesAPI {
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

describe("NotesAPI RPC contract", () => {
  it("create performs create then update", async () => {
    const api = new TestNotesAPI();
    api.setResponses([[["note-1"]]], null);

    const note = await api.create("nb-1", "hello");

    expect(api.calls).toHaveLength(2);
    expect(api.calls[0]).toEqual({
      method: RPCMethod.CREATE_NOTE,
      payload: ["nb-1", "", [1], null, "New Note"],
      options: { sourcePath: "/notebook/nb-1" },
    });
    expect(api.calls[1]).toEqual({
      method: RPCMethod.UPDATE_NOTE,
      payload: ["nb-1", "note-1", [[["hello", "New Note", [], 0]]]],
      options: { sourcePath: "/notebook/nb-1", allowNull: true },
    });
    expect(note.id).toBe("note-1");
  });

  it("delete uses migrated payload", async () => {
    const api = new TestNotesAPI();
    api.setResponses(null);

    await api.delete("nb-1", "note-1");

    expect(api.calls[0]).toEqual({
      method: RPCMethod.DELETE_NOTE,
      payload: ["nb-1", null, ["note-1"]],
      options: { sourcePath: "/notebook/nb-1", allowNull: true },
    });
  });
});
