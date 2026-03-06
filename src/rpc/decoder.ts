// Parses chunked batchexecute responses from Google NotebookLM.
//
// Response format:
//   )]}'\n
//   <size>\n
//   <json_chunk>\n
//   <size>\n
//   <json_chunk>\n
//   ...
//
// Each json_chunk is a JSON array. We look for:
//   ["wrb.fr", "<method_id>", "<result_json>", ...]  — success
//   ["er", <details>]                                 — error

import { DecodingError, RPCError, AuthError } from "../exceptions.ts";

export interface DecodedChunk {
  type: "result" | "error" | "info";
  methodId?: string;
  data: unknown;
  raw: unknown[];
}

const JUNK_PREFIX = ")]}'\n";

/**
 * Strip the )]}' prefix and split the response into raw JSON chunks.
 */
export function splitChunks(responseText: string): string[] {
  let text = responseText;
  if (text.startsWith(JUNK_PREFIX)) {
    text = text.slice(JUNK_PREFIX.length);
  } else if (text.startsWith(")]}'")) {
    text = text.slice(5);
  }

  const chunks: string[] = [];
  let i = 0;

  while (i < text.length) {
    // Read size line
    const newline = text.indexOf("\n", i);
    if (newline === -1) break;
    const sizeLine = text.slice(i, newline).trim();
    if (!sizeLine) {
      i = newline + 1;
      continue;
    }
    const size = parseInt(sizeLine, 10);
    if (isNaN(size) || size <= 0) {
      i = newline + 1;
      continue;
    }
    i = newline + 1;
    // Read <size> bytes of JSON
    const chunk = text.slice(i, i + size);
    chunks.push(chunk);
    i += size;
    // Skip trailing newline
    if (text[i] === "\n") i++;
  }

  return chunks;
}

/**
 * Parse a single raw chunk string into a DecodedChunk.
 */
export function parseChunk(raw: string): DecodedChunk | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) return null;

  // Outer array contains sub-arrays
  for (const item of parsed as unknown[]) {
    if (!Array.isArray(item)) continue;
    const arr = item as unknown[];

    if (arr[0] === "wrb.fr") {
      // Success: ["wrb.fr", "METHOD_ID", "<result_json>", ...]
      const methodId = arr[1] as string;
      const resultJson = arr[2];
      let data: unknown = resultJson;
      if (typeof resultJson === "string") {
        try {
          data = JSON.parse(resultJson);
        } catch {
          data = resultJson;
        }
      }
      return { type: "result", methodId, data, raw: arr };
    }

    if (arr[0] === "er") {
      // Error: ["er", <status_info>]
      return { type: "error", data: arr.slice(1), raw: arr };
    }

    if (arr[0] === "di" || arr[0] === "e" || arr[0] === "c") {
      return { type: "info", data: arr.slice(1), raw: arr };
    }
  }

  return null;
}

/**
 * Decode a full batchexecute response and return results keyed by method ID.
 * Throws DecodingError or RPCError on failure.
 */
export function decodeResponse(responseText: string, expectedMethod: string): unknown {
  if (!responseText || responseText.trim() === "") {
    throw new DecodingError("Empty response from server", expectedMethod);
  }

  // Check for HTTP-level auth failure embedded as HTML
  if (responseText.trimStart().startsWith("<!")) {
    throw new AuthError("Received HTML response — authentication may have expired", expectedMethod);
  }

  const rawChunks = splitChunks(responseText);
  if (rawChunks.length === 0) {
    throw new DecodingError(`No chunks found in response for ${expectedMethod}`, expectedMethod);
  }

  const results: Map<string, unknown> = new Map();
  const errors: DecodedChunk[] = [];

  for (const raw of rawChunks) {
    const chunk = parseChunk(raw);
    if (!chunk) continue;

    if (chunk.type === "result" && chunk.methodId) {
      results.set(chunk.methodId, chunk.data);
    } else if (chunk.type === "error") {
      errors.push(chunk);
    }
  }

  if (errors.length > 0 && results.size === 0) {
    const errData = JSON.stringify(errors[0].data);
    throw new RPCError(`RPC error for ${expectedMethod}: ${errData}`, expectedMethod);
  }

  if (!results.has(expectedMethod)) {
    // Try to return first result if method ID doesn't match (some responses omit it)
    if (results.size === 1) {
      return results.values().next().value;
    }
    throw new DecodingError(
      `No result found for method ${expectedMethod}. Got: ${[...results.keys()].join(", ")}`,
      expectedMethod,
    );
  }

  return results.get(expectedMethod);
}

/**
 * Decode a multi-call batchexecute response.
 * Returns a map of methodId -> data.
 */
export function decodeMultiResponse(responseText: string): Map<string, unknown> {
  const rawChunks = splitChunks(responseText);
  const results = new Map<string, unknown>();

  for (const raw of rawChunks) {
    const chunk = parseChunk(raw);
    if (chunk?.type === "result" && chunk.methodId) {
      results.set(chunk.methodId, chunk.data);
    }
  }

  return results;
}
