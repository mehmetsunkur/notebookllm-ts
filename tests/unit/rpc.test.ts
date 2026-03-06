import { describe, it, expect } from "vitest";
import { encodeRequest, encodeMultiRequest } from "../../src/rpc/encoder.ts";
import { splitChunks, parseChunk, decodeResponse } from "../../src/rpc/decoder.ts";
import { DecodingError, AuthError, RPCError } from "../../src/exceptions.ts";

describe("RPC Encoder", () => {
  const baseParams = {
    method: "muqnm",
    payload: ["notebookId123"],
    csrfToken: "csrf_abc123",
    sid: "sid_xyz",
    bl: "bl_hash",
    hl: "en",
  };

  it("builds correct URL with query params", () => {
    const { url } = encodeRequest(baseParams);
    expect(url).toContain("batchexecute");
    expect(url).toContain("rpcids=muqnm");
    expect(url).toContain("f.sid=sid_xyz");
    expect(url).toContain("bl=bl_hash");
    expect(url).toContain("rt=c");
    expect(url).toContain("hl=en");
  });

  it("encodes body as form-encoded with f.req and at", () => {
    const { body } = encodeRequest(baseParams);
    expect(body).toContain("f.req=");
    expect(body).toContain("at=csrf_abc123");
    expect(body.endsWith("&")).toBe(true);
  });

  it("wraps payload in triple-nested JSON array", () => {
    const { body } = encodeRequest(baseParams);
    const params = new URLSearchParams(body);
    const freq = params.get("f.req");
    expect(freq).not.toBeNull();
    const parsed = JSON.parse(freq!);
    expect(Array.isArray(parsed)).toBe(true);
    expect(Array.isArray(parsed[0])).toBe(true);
    expect(Array.isArray(parsed[0][0])).toBe(true);
    expect(parsed[0][0][0]).toBe("muqnm");
  });

  it("defaults hl to 'en' when not specified", () => {
    const { url } = encodeRequest({ ...baseParams, hl: undefined });
    expect(url).toContain("hl=en");
  });

  it("supports overriding source-path", () => {
    const { url } = encodeRequest({ ...baseParams, sourcePath: "/notebook/abc123" });
    expect(url).toContain("source-path=%2Fnotebook%2Fabc123");
  });

  it("encodeMultiRequest handles multiple calls", () => {
    const { url, body } = encodeMultiRequest(
      [
        { method: "muqnm", payload: ["nb1"] },
        { method: "QTsXBe", payload: ["new title"] },
      ],
      "csrf",
      "sid",
      "bl",
    );
    expect(url).toContain("rpcids=muqnm%2CQTsXBe");
    const params = new URLSearchParams(body);
    const parsed = JSON.parse(params.get("f.req")!);
    expect(parsed[0]).toHaveLength(2);
  });
});

describe("RPC Decoder - splitChunks", () => {
  it("strips )]}' prefix and splits chunks by size", () => {
    const chunk1 = '[["di","batch1"]]';
    const chunk2 = '[["wrb.fr","muqnm","result",null]]';
    const response = `)]}'\n${chunk1.length}\n${chunk1}\n${chunk2.length}\n${chunk2}\n`;
    const chunks = splitChunks(response);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe(chunk1);
    expect(chunks[1]).toBe(chunk2);
  });

  it("handles missing prefix gracefully", () => {
    const chunk = '[["wrb.fr","test","data"]]';
    const response = `${chunk.length}\n${chunk}\n`;
    const chunks = splitChunks(response);
    expect(chunks).toHaveLength(1);
  });

  it("returns empty array for empty response", () => {
    expect(splitChunks("")).toHaveLength(0);
  });
});

describe("RPC Decoder - parseChunk", () => {
  it("parses wrb.fr result chunk", () => {
    const data = JSON.stringify({ notebooks: ["nb1"] });
    // Real batchexecute format: [["wrb.fr", methodId, data, ...]]
    const raw = JSON.stringify([["wrb.fr", "muqnm", data, null, null, null, "generic"]]);
    const chunk = parseChunk(raw);
    expect(chunk).not.toBeNull();
    expect(chunk!.type).toBe("result");
    expect(chunk!.methodId).toBe("muqnm");
    expect(chunk!.data).toEqual({ notebooks: ["nb1"] });
  });

  it("parses er error chunk", () => {
    const raw = JSON.stringify([["er", 500, "Internal Error"]]);
    const chunk = parseChunk(raw);
    expect(chunk).not.toBeNull();
    expect(chunk!.type).toBe("error");
  });

  it("parses di info chunk", () => {
    const raw = JSON.stringify([["di", "batch123"]]);
    const chunk = parseChunk(raw);
    expect(chunk).not.toBeNull();
    expect(chunk!.type).toBe("info");
  });

  it("returns null for invalid JSON", () => {
    expect(parseChunk("not json")).toBeNull();
  });

  it("returns null for non-array JSON", () => {
    expect(parseChunk('"just a string"')).toBeNull();
  });
});

describe("RPC Decoder - decodeResponse", () => {
  function makeResponse(methodId: string, resultData: unknown): string {
    const inner = typeof resultData === "string" ? resultData : JSON.stringify(resultData);
    // Real format: [["wrb.fr", methodId, data, ...]]
    const chunk = JSON.stringify([["wrb.fr", methodId, inner, null, null, null, "g"]]);
    return `)]}'\n${chunk.length}\n${chunk}\n`;
  }

  it("decodes a successful response", () => {
    const response = makeResponse("muqnm", [["nb1", "My Notebook"]]);
    const result = decodeResponse(response, "muqnm");
    expect(Array.isArray(result)).toBe(true);
  });

  it("throws DecodingError for empty response", () => {
    expect(() => decodeResponse("", "muqnm")).toThrow(DecodingError);
  });

  it("throws AuthError for HTML response", () => {
    expect(() => decodeResponse("<!DOCTYPE html>", "muqnm")).toThrow(AuthError);
  });

  it("throws DecodingError when multiple methods present but none match", () => {
    // Two results, neither matches — should throw rather than guess
    const chunk1 = JSON.stringify([["wrb.fr", "methodA", '"data1"', null]]);
    const chunk2 = JSON.stringify([["wrb.fr", "methodB", '"data2"', null]]);
    const response =
      `)]}'\n${chunk1.length}\n${chunk1}\n${chunk2.length}\n${chunk2}\n`;
    expect(() => decodeResponse(response, "muqnm")).toThrow(DecodingError);
  });

  it("throws RPCError when only error chunks present", () => {
    const chunk = JSON.stringify([["er", 403, "Unauthorized"]]);
    const response = `)]}'\n${chunk.length}\n${chunk}\n`;
    expect(() => decodeResponse(response, "muqnm")).toThrow(RPCError);
  });

  it("returns first result if only one method in response regardless of name", () => {
    const chunk = JSON.stringify([["wrb.fr", "differentId", '"data"', null]]);
    const response = `)]}'\n${chunk.length}\n${chunk}\n`;
    const result = decodeResponse(response, "expectedId");
    expect(result).toBe("data");
  });
});
