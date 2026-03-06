// Builds the batchexecute request body and URL for Google NotebookLM RPCs.
//
// Request format:
//   POST https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute
//     ?rpcids=<method>&source-path=/&f.sid=<sid>&bl=<bl>&hl=en&soc-app=1&soc-platform=1&soc-device=1&rt=c
//   Content-Type: application/x-www-form-urlencoded
//   Body: f.req=<url-encoded envelope>&at=<csrf>&

const BASE_URL = "https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute";

export interface RPCRequest {
  /** RPC method ID (e.g. "muqnm") */
  method: string;
  /** JSON-serializable payload — will be JSON.stringify'd into the envelope */
  payload: unknown;
  /** CSRF token (SNLM0e) */
  csrfToken: string;
  /** Session ID (FdrFJe / f.sid) */
  sid: string;
  /** Blob hash (cfb2h / bl) */
  bl: string;
  /** Language tag (default "en") */
  hl?: string;
}

export interface EncodedRequest {
  url: string;
  body: string;
}

/**
 * Build the full URL and form-encoded body for a batchexecute RPC call.
 */
export function encodeRequest(req: RPCRequest): EncodedRequest {
  const hl = req.hl ?? "en";

  const params = new URLSearchParams({
    rpcids: req.method,
    "source-path": "/",
    "f.sid": req.sid,
    bl: req.bl,
    hl,
    "soc-app": "1",
    "soc-platform": "1",
    "soc-device": "1",
    rt: "c",
  });

  const url = `${BASE_URL}?${params.toString()}`;

  // The envelope: triple-nested JSON array
  // [[["<method>","<json_payload>",null,"1"]]]
  const innerPayload = JSON.stringify(req.payload);
  const envelope = JSON.stringify([[[req.method, innerPayload, null, "1"]]]);

  const bodyParams = new URLSearchParams({
    "f.req": envelope,
    at: req.csrfToken,
  });
  // Append trailing & to match Python implementation
  const body = bodyParams.toString() + "&";

  return { url, body };
}

/**
 * Encode a multi-call batchexecute request (multiple RPCs in one HTTP call).
 */
export function encodeMultiRequest(
  calls: { method: string; payload: unknown }[],
  csrfToken: string,
  sid: string,
  bl: string,
  hl = "en",
): EncodedRequest {
  const rpcids = calls.map((c) => c.method).join(",");

  const params = new URLSearchParams({
    rpcids,
    "source-path": "/",
    "f.sid": sid,
    bl,
    hl,
    "soc-app": "1",
    "soc-platform": "1",
    "soc-device": "1",
    rt: "c",
  });

  const url = `${BASE_URL}?${params.toString()}`;

  const envelopeItems = calls.map((c, i) => [
    c.method,
    JSON.stringify(c.payload),
    null,
    String(i + 1),
  ]);
  const envelope = JSON.stringify([envelopeItems]);

  const bodyParams = new URLSearchParams({
    "f.req": envelope,
    at: csrfToken,
  });
  const body = bodyParams.toString() + "&";

  return { url, body };
}
