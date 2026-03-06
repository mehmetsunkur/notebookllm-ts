import { ClientCore } from "./core.ts";
import { RPCMethod } from "../rpc/methods.ts";
import type { ChatMessage, ChatResponse } from "../types.ts";

export class ChatAPI extends ClientCore {
  async ask(
    notebookId: string,
    question: string,
    options: {
      conversationId?: string;
      sourceIds?: string[];
      saveAsNote?: boolean;
    } = {},
  ): Promise<ChatResponse> {
    const raw = await this.rpc(RPCMethod.ASK, [
      notebookId,
      question,
      options.conversationId ?? null,
      options.sourceIds ?? null,
      options.saveAsNote ?? false,
    ]);
    return parseChatResponse(raw);
  }

  async history(
    notebookId: string,
    conversationId?: string,
  ): Promise<ChatMessage[]> {
    const raw = await this.rpc(RPCMethod.CHAT_HISTORY, [notebookId, conversationId ?? null]);
    return parseChatHistory(raw);
  }

  async clearHistory(notebookId: string, conversationId?: string): Promise<void> {
    await this.rpc(RPCMethod.CHAT_HISTORY, [notebookId, conversationId ?? null, true]);
  }

  async configure(notebookId: string, mode: string): Promise<void> {
    await this.rpc(RPCMethod.CONFIGURE_CHAT, [notebookId, mode]);
  }
}

// --- Parsers ---

function parseChatResponse(raw: unknown): ChatResponse {
  if (!Array.isArray(raw)) {
    return { answer: String(raw ?? "") };
  }
  const arr = raw as unknown[];
  const answer = String(arr[0] ?? "");
  const conversationId = typeof arr[1] === "string" ? arr[1] : undefined;

  const citations = Array.isArray(arr[2])
    ? (arr[2] as unknown[]).map((c) => {
        if (!Array.isArray(c)) return { sourceId: "" };
        return { sourceId: String((c as unknown[])[0] ?? ""), text: String((c as unknown[])[1] ?? "") };
      })
    : undefined;

  const followUpQuestions = Array.isArray(arr[3])
    ? (arr[3] as unknown[]).map(String)
    : undefined;

  return { answer, conversationId, citations, followUpQuestions };
}

function parseChatHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const outer = raw as unknown[];
  const list = Array.isArray(outer[0]) ? (outer[0] as unknown[]) : outer;

  return list.filter(Array.isArray).map((item) => {
    const arr = item as unknown[];
    return {
      role: (arr[0] === "user" ? "user" : "assistant") as ChatMessage["role"],
      content: String(arr[1] ?? ""),
      timestamp: typeof arr[2] === "number" ? arr[2] : undefined,
    };
  });
}
