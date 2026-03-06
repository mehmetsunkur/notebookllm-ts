import { ClientCore } from "./core.ts";
import { RPCMethod } from "../rpc/methods.ts";
import type { Notebook } from "../types.ts";
import { NotebookNotFoundError } from "../exceptions.ts";

export class NotebooksAPI extends ClientCore {
  async list(): Promise<Notebook[]> {
    const raw = await this.rpc(RPCMethod.LIST_NOTEBOOKS, []);
    return parseNotebookList(raw);
  }

  async create(title: string): Promise<Notebook> {
    const raw = await this.rpc(RPCMethod.CREATE_NOTEBOOK, [title]);
    return parseNotebook(raw);
  }

  async delete(notebookId: string): Promise<void> {
    await this.rpc(RPCMethod.DELETE_NOTEBOOK, [notebookId]);
  }

  async rename(notebookId: string, newTitle: string): Promise<Notebook> {
    const raw = await this.rpc(RPCMethod.RENAME_NOTEBOOK, [notebookId, newTitle]);
    return parseNotebook(raw);
  }

  async get(notebookId: string): Promise<Notebook> {
    const raw = await this.rpc(RPCMethod.GET_NOTEBOOK, [notebookId]);
    return parseNotebook(raw);
  }

  async summary(notebookId: string): Promise<string> {
    const raw = await this.rpc(RPCMethod.NOTEBOOK_SUMMARY, [notebookId]);
    if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
    return String(raw);
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
  // Typical NotebookLM response: [[id, title, ...], ...]
  const arr = raw as unknown[];
  const id = String(arr[0] ?? "");
  const title = String(arr[1] ?? "");
  const createdMs = typeof arr[4] === "number" ? arr[4] : undefined;
  const updatedMs = typeof arr[5] === "number" ? arr[5] : undefined;

  return { id, title, createdMs, updatedMs };
}

function parseNotebookList(raw: unknown): Notebook[] {
  if (!Array.isArray(raw)) return [];

  // Response is typically [[notebook_array, ...], ...] at index 0
  const outer = raw as unknown[];
  const list = Array.isArray(outer[0]) ? (outer[0] as unknown[]) : outer;

  return list
    .filter((item) => Array.isArray(item))
    .map((item) => parseNotebook(item));
}
