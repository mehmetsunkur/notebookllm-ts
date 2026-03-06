import { ClientCore } from "./core.ts";
import { RPCMethod } from "../rpc/methods.ts";
import type { Note } from "../types.ts";

export class NotesAPI extends ClientCore {
  async list(notebookId: string): Promise<Note[]> {
    const raw = await this.rpc(RPCMethod.LIST_NOTES, [notebookId], {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: true,
    });
    return parseNoteList(raw);
  }

  async create(notebookId: string, content: string): Promise<Note> {
    const title = "New Note";
    const raw = await this.rpc(
      RPCMethod.CREATE_NOTE,
      [notebookId, "", [1], null, title],
      { sourcePath: `/notebook/${notebookId}` },
    );

    const noteId = extractCreatedNoteId(raw);
    if (!noteId) {
      return { id: "", title, content };
    }

    await this.update(notebookId, noteId, content, title);
    return { id: noteId, title, content };
  }

  async get(notebookId: string, noteId: string): Promise<Note> {
    const notes = await this.list(notebookId);
    const note = notes.find((n) => n.id === noteId);
    if (note) return note;
    return { id: noteId, title: "", content: "" };
  }

  async rename(notebookId: string, noteId: string, newTitle: string): Promise<Note> {
    const existing = await this.get(notebookId, noteId);
    await this.update(notebookId, noteId, existing.content, newTitle);
    return this.get(notebookId, noteId);
  }

  async delete(notebookId: string, noteId: string): Promise<void> {
    await this.rpc(
      RPCMethod.DELETE_NOTE,
      [notebookId, null, [noteId]],
      { sourcePath: `/notebook/${notebookId}`, allowNull: true },
    );
  }

  async save(notebookId: string, noteId: string, content: string): Promise<Note> {
    const existing = await this.get(notebookId, noteId);
    await this.update(notebookId, noteId, content, existing.title || "New Note");
    return this.get(notebookId, noteId);
  }

  async update(notebookId: string, noteId: string, content: string, title: string): Promise<void> {
    await this.rpc(
      RPCMethod.UPDATE_NOTE,
      [notebookId, noteId, [[[content, title, [], 0]]]],
      { sourcePath: `/notebook/${notebookId}`, allowNull: true },
    );
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
  const list = Array.isArray(outer[0]) ? (outer[0] as unknown[]) : [];

  return list
    .filter(Array.isArray)
    .map((item) => {
      const arr = item as unknown[];
      const id = String(arr[0] ?? "");
      const isDeleted = arr[1] == null && arr[2] === 2;
      if (isDeleted) {
        return null;
      }
      let title = "";
      let content = "";

      if (typeof arr[1] === "string") {
        content = arr[1];
      } else if (Array.isArray(arr[1])) {
        const inner = arr[1] as unknown[];
        content = typeof inner[1] === "string" ? inner[1] : "";
        title = typeof inner[4] === "string" ? inner[4] : "";
      }

      return { id, title, content } as Note;
    })
    .filter((n): n is Note => n !== null)
    .filter((n) => n.id.length > 0);
}

function extractCreatedNoteId(raw: unknown): string | undefined {
  if (Array.isArray(raw)) {
    if (typeof raw[0] === "string") return raw[0];
    if (Array.isArray(raw[0])) {
      return extractCreatedNoteId(raw[0]);
    }
  }
  return undefined;
}
