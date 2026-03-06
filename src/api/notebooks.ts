import { ClientCore } from "./core.ts";
import { RPCMethod } from "../rpc/methods.ts";
import type { Notebook, NotebookDescription, SuggestedTopic } from "../types.ts";
import { NotebookNotFoundError } from "../exceptions.ts";

export class NotebooksAPI extends ClientCore {
  async list(): Promise<Notebook[]> {
    const raw = await this.rpc(RPCMethod.LIST_NOTEBOOKS, [null, 1, null, [2]]);
    return parseNotebookList(raw);
  }

  async create(title: string): Promise<Notebook> {
    const raw = await this.rpc(RPCMethod.CREATE_NOTEBOOK, [title, null, null, [2], [1]]);
    return parseNotebook(raw);
  }

  async delete(notebookId: string): Promise<void> {
    await this.rpc(RPCMethod.DELETE_NOTEBOOK, [[notebookId], [2]]);
  }

  async rename(notebookId: string, newTitle: string): Promise<Notebook> {
    await this.rpc(
      RPCMethod.RENAME_NOTEBOOK,
      [notebookId, [[null, null, null, [null, newTitle]]]],
      { allowNull: true, sourcePath: "/" },
    );
    return this.get(notebookId);
  }

  async get(notebookId: string): Promise<Notebook> {
    const raw = await this.rpc(
      RPCMethod.GET_NOTEBOOK,
      [notebookId, null, [2], null, 0],
      { sourcePath: `/notebook/${notebookId}` },
    );
    const arr = Array.isArray(raw) && Array.isArray(raw[0]) ? raw[0] : raw;
    return parseNotebook(arr);
  }

  async summary(notebookId: string): Promise<string> {
    const raw = await this.rpc(
      RPCMethod.NOTEBOOK_SUMMARY,
      [notebookId, [2]],
      { sourcePath: `/notebook/${notebookId}` },
    );
    // Summary response is typically nested as result[0][0][0]
    if (
      Array.isArray(raw) &&
      Array.isArray(raw[0]) &&
      Array.isArray(raw[0][0]) &&
      typeof raw[0][0][0] === "string"
    ) {
      return raw[0][0][0];
    }
    if (Array.isArray(raw) && Array.isArray(raw[0]) && typeof raw[0][0] === "string") {
      return raw[0][0];
    }
    if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
    return String(raw);
  }

  /** Get AI-generated summary and suggested topics for a notebook. */
  async getDescription(notebookId: string): Promise<NotebookDescription> {
    const raw = await this.rpc(
      RPCMethod.NOTEBOOK_SUMMARY,
      [notebookId, [2]],
      { sourcePath: `/notebook/${notebookId}` },
    );

    let summary = "";
    const suggestedTopics: SuggestedTopic[] = [];

    // Response structure: [[[summary_string], [[topics]], ...]]
    // Summary is at result[0][0][0], topics at result[0][1][0]
    if (Array.isArray(raw)) {
      try {
        const outer = raw[0] as unknown[];
        const summaryVal = (outer[0] as unknown[])?.[0];
        summary = typeof summaryVal === "string" ? summaryVal : "";

        const topicsList = ((outer[1] as unknown[])?.[0]) as unknown[] | undefined;
        if (Array.isArray(topicsList)) {
          for (const topic of topicsList) {
            if (Array.isArray(topic) && topic.length >= 2) {
              suggestedTopics.push({
                question: typeof topic[0] === "string" ? topic[0] : "",
                prompt: typeof topic[1] === "string" ? topic[1] : "",
              });
            }
          }
        }
      } catch {
        // partial result is acceptable (e.g. summary but no topics yet)
      }
    }

    return { summary, suggestedTopics };
  }

  /** Find a notebook by partial ID match. */
  async findById(partialId: string): Promise<Notebook> {
    const notebooks = await this.list();
    const match = notebooks.find(
      (n) => n.id === partialId || n.id.startsWith(partialId),
    );
    if (!match) {
      throw new NotebookNotFoundError(
        `No notebook found matching ID prefix: ${partialId}`,
      );
    }
    return match;
  }
}

// --- Response parsers ---

function parseNotebook(raw: unknown): Notebook {
  if (!Array.isArray(raw)) {
    return { id: "", title: String(raw) };
  }

  // Current NotebookLM list shape (matches notebooklm-py):
  // [title, sources, notebook_id, ..., meta]
  const arr = raw as unknown[];
  const titleRaw = typeof arr[0] === "string" ? arr[0] : "";
  const id = typeof arr[2] === "string" ? arr[2] : "";
  const title = titleRaw.replace("thought\n", "").trim();

  const sourceCount = Array.isArray(arr[1]) ? arr[1].length : undefined;

  let createdMs: number | undefined;
  const meta = arr[5];
  if (Array.isArray(meta) && Array.isArray(meta[5]) && typeof meta[5][0] === "number") {
    createdMs = Math.round(meta[5][0] * 1000);
  }

  return { id, title, sourceCount, createdMs };
}

function parseNotebookList(raw: unknown): Notebook[] {
  if (!Array.isArray(raw)) return [];

  // Response is typically [[notebook_array, ...], ...] at index 0
  const outer = raw as unknown[];
  const list = Array.isArray(outer[0]) ? (outer[0] as unknown[]) : outer;

  return list
    .filter((item) => Array.isArray(item))
    .map((item) => parseNotebook(item))
    .filter((nb) => nb.id && nb.title);
}
