// NotebookLMClient — the main public API class.
// Composes all sub-API namespaces into a single entry point.

import { ClientCore, type CoreOptions } from "./core.ts";
import { NotebooksAPI } from "./notebooks.ts";
import { SourcesAPI } from "./sources.ts";
import { GenerateAPI } from "./artifacts.ts";
import { ChatAPI } from "./chat.ts";
import { ResearchAPI } from "./research.ts";
import { NotesAPI } from "./notes.ts";
import { SettingsAPI } from "./settings.ts";
import { SharingAPI } from "./sharing.ts";
import { getContextPath } from "../paths.ts";
import type { Context } from "../types.ts";

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
    const contextPath = getContextPath(this.options.homeDir);
    const file = Bun.file(contextPath);
    if (!(await file.exists())) return {};
    try {
      return JSON.parse(await file.text()) as Context;
    } catch {
      return {};
    }
  }

  /** Save context to disk. */
  async saveContext(context: Context): Promise<void> {
    const contextPath = getContextPath(this.options.homeDir);
    await Bun.write(contextPath, JSON.stringify(context, null, 2));
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
