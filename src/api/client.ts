// NotebookLMClient — the main public API class.
// Composes all sub-API namespaces into a single entry point.

import { ClientCore, type CoreOptions } from "./core.js";
import { NotebooksAPI } from "./notebooks.js";
import { SourcesAPI } from "./sources.js";
import { GenerateAPI } from "./artifacts.js";
import { ChatAPI } from "./chat.js";
import { ResearchAPI } from "./research.js";
import { NotesAPI } from "./notes.js";
import { SettingsAPI } from "./settings.js";
import { SharingAPI } from "./sharing.js";
import { getContextPath } from "../paths.js";
import type { Context } from "../types.js";

export class NotebookLMClient {
  readonly notebooks: NotebooksAPI;
  readonly sources: SourcesAPI;
  readonly generate: GenerateAPI;
  readonly artifacts: GenerateAPI;
  readonly chat: ChatAPI;
  readonly research: ResearchAPI;
  readonly notes: NotesAPI;
  readonly settings: SettingsAPI;
  readonly sharing: SharingAPI;

  private readonly options: CoreOptions;

  constructor(options: CoreOptions = {}) {
    this.options = options;
    this.notebooks = new NotebooksAPI(options);
    this.sources = new SourcesAPI(options);
    this.generate = new GenerateAPI(options);
    this.artifacts = this.generate;
    this.chat = new ChatAPI(options);
    this.research = new ResearchAPI(options);
    this.notes = new NotesAPI(options);
    this.settings = new SettingsAPI(options);
    this.sharing = new SharingAPI(options);
  }

  /** Load the current context (active notebook + conversation IDs). */
  async loadContext(): Promise<Context> {
    const { readFile, access } = await import("fs/promises");
    const contextPath = getContextPath(this.options.homeDir);
    const exists = await access(contextPath).then(() => true).catch(() => false);
    if (!exists) return {};
    try {
      return JSON.parse(await readFile(contextPath, "utf-8")) as Context;
    } catch {
      return {};
    }
  }

  /** Save context to disk. */
  async saveContext(context: Context): Promise<void> {
    const { writeFile } = await import("fs/promises");
    const contextPath = getContextPath(this.options.homeDir);
    await writeFile(contextPath, JSON.stringify(context, null, 2));
  }

  /** Clear context. */
  async clearContext(): Promise<void> {
    await this.saveContext({});
  }

  /** Get current active notebook ID (from context). */
  async getActiveNotebookId(): Promise<string | undefined> {
    const ctx = await this.loadContext();
    return ctx.notebookId;
  }

  /** Set active notebook (with partial ID matching). */
  async useNotebook(partialId: string): Promise<string> {
    const notebook = await this.notebooks.findById(partialId);
    const ctx = await this.loadContext();
    await this.saveContext({ ...ctx, notebookId: notebook.id });
    return notebook.id;
  }

  /** Invalidate cached auth on all sub-APIs. */
  invalidateAuth(): void {
    const apis: CoreOptions[] = [
      this.notebooks,
      this.sources,
      this.generate,
      this.chat,
      this.research,
      this.notes,
      this.settings,
      this.sharing,
    ] as unknown as CoreOptions[];
    for (const api of [
      this.notebooks,
      this.sources,
      this.generate,
      this.chat,
      this.research,
      this.notes,
      this.settings,
      this.sharing,
    ]) {
      (api as unknown as ClientCore).invalidateAuth();
    }
  }
}
