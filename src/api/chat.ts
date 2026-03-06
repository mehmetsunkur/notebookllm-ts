import { ClientCore } from "./core.ts";
import { RPCMethod } from "../rpc/methods.ts";
import type { ChatMessage, ChatResponse } from "../types.ts";
import { NetworkError } from "../exceptions.ts";
import { rpcErrorFromStatus } from "../rpc/errors.ts";

const CHAT_QUERY_URL =
  "https://notebooklm.google.com/_/LabsTailwindUi/data/google.internal.labs.tailwind.orchestration.v1.LabsTailwindOrchestrationService/GenerateFreeFormStreamed";

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
    await this.ensureAuth();

    const sourceIds = options.sourceIds ?? [];
    const sourcesArray = sourceIds.map((sid) => [[sid]]);
    const conversationId = options.conversationId ?? crypto.randomUUID();

    const params = [
      sourcesArray,
      question,
      null,
      [2, null, [1], [1]],
      conversationId,
      null,
      null,
      notebookId,
      1,
    ];

    const fReq = [null, JSON.stringify(params)];
    const body = `f.req=${encodeURIComponent(JSON.stringify(fReq))}&at=${encodeURIComponent(this.getTokens().snlm0e)}&`;

    const urlParams = new URLSearchParams({
      bl: this.getTokens().cfb2h,
      hl: this.language ?? "en",
      _reqid: String(Date.now()),
      rt: "c",
      "f.sid": this.getTokens().fdrfje,
    });
    const url = `${CHAT_QUERY_URL}?${urlParams.toString()}`;

    if (this.verbose) {
      console.error(`[CHAT] ask -> ${url}`);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          Cookie: this.getCookieHeader(),
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://notebooklm.google.com/",
          "X-Same-Domain": "1",
        },
        body,
      });
    } catch (e) {
      throw new NetworkError(
        `Network error calling ask: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    if (!response.ok) {
      throw rpcErrorFromStatus(response.status, "ask");
    }

    const text = await response.text();
    const parsed = parseAskStreamResponse(text);

    return {
      answer: parsed.answer,
      conversationId: parsed.conversationId ?? conversationId,
    };
  }

  async history(
    notebookId: string,
    conversationId?: string,
  ): Promise<ChatMessage[]> {
    const effectiveConversationId = conversationId ?? (await this.getLastConversationId(notebookId));
    if (!effectiveConversationId) return [];
    const raw = await this.rpc(
      RPCMethod.GET_CONVERSATION_TURNS,
      [[], null, null, effectiveConversationId, 100],
      { sourcePath: `/notebook/${notebookId}` },
    );
    return parseConversationTurns(raw);
  }

  async clearHistory(notebookId: string, conversationId?: string): Promise<void> {
    const _ignore = { notebookId, conversationId };
    // NotebookLM currently has no stable clear-history RPC contract.
    // Keep method for CLI compatibility.
    void _ignore;
  }

  async configure(notebookId: string, mode: string): Promise<void> {
    const settings = mapChatMode(mode);
    await this.rpc(
      RPCMethod.RENAME_NOTEBOOK,
      [
        notebookId,
        [[null, null, null, null, null, null, null, [[settings.goal], [settings.length]]]],
      ],
      { sourcePath: `/notebook/${notebookId}`, allowNull: true },
    );
  }

  async getLastConversationId(notebookId: string): Promise<string | undefined> {
    const raw = await this.rpc(
      RPCMethod.GET_LAST_CONVERSATION_ID,
      [[], null, notebookId, 1],
      { sourcePath: `/notebook/${notebookId}` },
    );
    return extractNestedConversationId(raw);
  }
}

// --- Parsers ---

function parseAskStreamResponse(
  responseText: string,
): { answer: string; conversationId?: string } {
  const lines = responseText
    .replace(/^\)\]\}'\n?/, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let bestMarkedAnswer = "";
  let bestUnmarkedAnswer = "";
  let conversationId: string | undefined;

  const processChunk = (jsonStr: string): void => {
    let data: unknown;
    try {
      data = JSON.parse(jsonStr);
    } catch {
      return;
    }
    if (!Array.isArray(data)) return;

    for (const item of data) {
      if (!Array.isArray(item) || item[0] !== "wrb.fr") continue;
      const innerJson = item[2];
      if (typeof innerJson !== "string") continue;

      let innerData: unknown;
      try {
        innerData = JSON.parse(innerJson);
      } catch {
        continue;
      }
      if (!Array.isArray(innerData) || !Array.isArray(innerData[0])) continue;

      const first = innerData[0] as unknown[];
      const text = typeof first[0] === "string" ? first[0] : "";
      if (!text) continue;

      const isMarkedAnswer =
        Array.isArray(first[4]) && first[4].length > 0 && first[4][first[4].length - 1] === 1;

      if (isMarkedAnswer) {
        if (text.length > bestMarkedAnswer.length) bestMarkedAnswer = text;
      } else if (text.length > bestUnmarkedAnswer.length) {
        bestUnmarkedAnswer = text;
      }

      if (Array.isArray(first[2]) && typeof first[2][0] === "string") {
        conversationId = first[2][0] as string;
      }
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const size = parseInt(line, 10);
    if (!Number.isNaN(size)) {
      if (i + 1 < lines.length) processChunk(lines[i + 1]);
      i += 1;
    } else {
      processChunk(line);
    }
  }

  const answer = bestMarkedAnswer || bestUnmarkedAnswer || "";
  return { answer, conversationId };
}

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

function parseConversationTurns(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw) || !Array.isArray(raw[0])) return [];
  const turns = (raw[0] as unknown[]).filter(Array.isArray) as unknown[][];
  const chronological = [...turns].reverse();

  return chronological
    .map((turn) => {
      const kind = turn[2];
      if (kind === 1) {
        return {
          role: "user" as const,
          content: String(turn[3] ?? ""),
        };
      }
      if (kind === 2) {
        const text =
          Array.isArray(turn[4]) && Array.isArray(turn[4][0]) && typeof turn[4][0][0] === "string"
            ? turn[4][0][0]
            : String(turn[4] ?? "");
        return {
          role: "assistant" as const,
          content: text,
        };
      }
      return null;
    })
    .filter((m): m is ChatMessage => m !== null && m.content.length > 0);
}

function extractNestedConversationId(raw: unknown): string | undefined {
  if (!Array.isArray(raw)) return undefined;
  for (const group of raw) {
    if (!Array.isArray(group)) continue;
    for (const conv of group) {
      if (Array.isArray(conv) && typeof conv[0] === "string") return conv[0];
    }
  }
  return undefined;
}

function mapChatMode(mode: string): { goal: number; length: number } {
  const normalized = mode.toLowerCase();
  if (normalized === "learning_guide" || normalized === "learning-guide") {
    return { goal: 3, length: 4 };
  }
  if (normalized === "concise") {
    return { goal: 1, length: 5 };
  }
  if (normalized === "detailed") {
    return { goal: 1, length: 4 };
  }
  return { goal: 1, length: 1 };
}
