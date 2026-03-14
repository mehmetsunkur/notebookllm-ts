import { RPCError, AuthError, RateLimitError, ServerError, ClientError } from "../exceptions.js";

export function rpcErrorFromStatus(
  statusCode: number,
  rpcId: string,
  message?: string,
): RPCError {
  const msg = message ?? `RPC ${rpcId} failed with status ${statusCode}`;
  if (statusCode === 401 || statusCode === 403) {
    return new AuthError(msg, rpcId, statusCode);
  }
  if (statusCode === 429) {
    return new RateLimitError(msg, rpcId, statusCode);
  }
  if (statusCode >= 500) {
    return new ServerError(msg, rpcId, statusCode);
  }
  if (statusCode >= 400) {
    return new ClientError(msg, rpcId, statusCode);
  }
  return new RPCError(msg, rpcId, statusCode);
}

export function isRPCError(chunk: unknown[]): boolean {
  return Array.isArray(chunk) && chunk[0] === "er";
}
