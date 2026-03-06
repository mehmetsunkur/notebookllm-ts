import { ClientCore } from "./core.ts";
import { RPCMethod } from "../rpc/methods.ts";
import type { Note } from "../types.ts";

export class NotesAPI extends ClientCore {
  async list(notebookId: string): Promise<Note[]> {
    const raw = await this.rpc(RPCMethod.LIST_NOTES, [notebookId]);
    return parseNoteList(raw);
  }

  async create(notebookId: string, content: string): Promise<Note> {
    const raw = await this.rpc(RPCMethod.CREATE_NOTE, [notebookId, content]);
    return parseNote(raw);
  }

  async get(notebookId: string, noteId: string): Promise<Note> {
    const raw = await this.rpc(RPCMethod.GET_NOTE, [notebookId, noteId]);
    return parseNote(raw);
  }

  async rename(notebookId: string, noteId: string, newTitle: string): Promise<Note> {
    const raw = await this.rpc(RPCMethod.RENAME_NOTE, [notebookId, noteId, newTitle]);
    return parseNote(raw);
  }

  async delete(notebookId: string, noteId: string): Promise<void> {
    await this.rpc(RPCMethod.DELETE_NOTE, [notebookId, noteId]);
  }

  async save(notebookId: string, noteId: string, content: string): Promise<Note> {
    const raw = await this.rpc(RPCMethod.SAVE_NOTE, [notebookId, noteId, content]);
    return parseNote(raw);
  }
}

// --- Parsers ---

function parseNote(raw: unknown): Note {
  if (!Array.isArray(raw)) {
    return { id: "", title: "", content: String(raw ?? "") };
  }
  const arr = raw as unknown[];
  return {
    id: String(arr[0] ?? ""),
    title: String(arr[1] ?? ""),
    content: String(arr[2] ?? ""),
    createdMs: typeof arr[3] === "number" ? arr[3] : undefined,
    updatedMs: typeof arr[4] === "number" ? arr[4] : undefined,
  };
}

function parseNoteList(raw: unknown): Note[] {
  if (!Array.isArray(raw)) return [];
  const outer = raw as unknown[];
  const list = Array.isArray(outer[0]) ? (outer[0] as unknown[]) : outer;
  return list.filter(Array.isArray).map(parseNote);
}
