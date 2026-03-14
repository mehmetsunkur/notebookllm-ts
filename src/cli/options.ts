// Shared CLI option helpers for Commander.js commands.

import type { Command } from "commander";
import { NotebookLMClient } from "../api/client.js";
import { getHomeDir, getStoragePath } from "../paths.js";
import type { GlobalOptions } from "../types.js";

/**
 * Get the resolved home dir from the root command's --storage option.
 */
export function resolveHomeDir(opts: GlobalOptions): string | undefined {
  return opts.storage;
}

/**
 * Build a NotebookLMClient from the root command's global options.
 */
export function makeClient(opts: GlobalOptions): NotebookLMClient {
  const homeDir = resolveHomeDir(opts);
  return new NotebookLMClient({
    storagePath: homeDir ? getStoragePath(homeDir) : undefined,
    homeDir,
    verbose: opts.verbose,
  });
}

/**
 * Resolve a partial ID prefix to a full ID by listing all entities.
 * IDs >= 20 chars are assumed complete and returned directly (no API call).
 * Exits with a helpful error if the prefix is ambiguous or not found.
 */
async function resolvePartialId(
  partial: string,
  listFn: () => Promise<Array<{ id: string; title?: string | null }>>,
  entityName: string,
  listCommand: string,
): Promise<string> {
  if (partial.length >= 20) return partial;

  const items = await listFn();
  const matches = items.filter((item) => item.id.toLowerCase().startsWith(partial.toLowerCase()));

  if (matches.length === 1) {
    if (matches[0].id !== partial) {
      const title = matches[0].title ?? "(untitled)";
      process.stderr.write(`Matched: ${matches[0].id.slice(0, 12)}... (${title})\n`);
    }
    return matches[0].id;
  }

  if (matches.length === 0) {
    console.error(
      `No ${entityName} found starting with '${partial}'. Run 'notebooklm ${listCommand}' to see available ${entityName}s.`,
    );
    process.exit(1);
  }

  const lines = [`Ambiguous ID '${partial}' matches ${matches.length} ${entityName}s:`];
  for (const m of matches.slice(0, 5)) {
    lines.push(`  ${m.id.slice(0, 12)}... ${m.title ?? "(untitled)"}`);
  }
  if (matches.length > 5) lines.push(`  ... and ${matches.length - 5} more`);
  lines.push("Specify more characters to narrow down.");
  console.error(lines.join("\n"));
  process.exit(1);
}

export async function resolveNotebookId(client: NotebookLMClient, partial: string): Promise<string> {
  return resolvePartialId(partial, () => client.notebooks.list(), "notebook", "list");
}

export async function resolveSourceId(
  client: NotebookLMClient,
  notebookId: string,
  partial: string,
): Promise<string> {
  return resolvePartialId(
    partial,
    () => client.sources.list(notebookId),
    "source",
    "source list",
  );
}

export async function resolveArtifactId(
  client: NotebookLMClient,
  notebookId: string,
  partial: string,
): Promise<string> {
  return resolvePartialId(
    partial,
    () => client.artifacts.list(notebookId),
    "artifact",
    "artifact list",
  );
}

export async function resolveNoteId(
  client: NotebookLMClient,
  notebookId: string,
  partial: string,
): Promise<string> {
  return resolvePartialId(
    partial,
    () => client.notes.list(notebookId),
    "note",
    "note list",
  );
}

/**
 * Get the active notebook ID from context; throw if none set.
 * Supports partial ID prefix matching for explicitly provided IDs.
 */
export async function requireNotebookId(
  client: NotebookLMClient,
  notebookId?: string,
): Promise<string> {
  if (notebookId) return resolveNotebookId(client, notebookId);
  const id = await client.getActiveNotebookId();
  if (!id) {
    console.error(
      'No active notebook. Use `notebooklm use <id>` to set one, or pass --notebook <id>.',
    );
    process.exit(1);
  }
  return id;
}

/**
 * Print output as JSON or call a pretty-printer.
 */
export function printOrJson<T>(
  data: T,
  json: boolean,
  pretty: (data: T) => void,
): void {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    pretty(data);
  }
}

/**
 * Handle errors uniformly: print message and exit.
 */
export function handleError(e: unknown): never {
  const message = e instanceof Error ? e.message : String(e);
  console.error(`Error: ${message}`);
  process.exit(1);
}

/**
 * Wrap a command action with standard error handling.
 */
export function action<T extends unknown[]>(
  fn: (...args: T) => Promise<void>,
): (...args: T) => void {
  return (...args: T) => {
    fn(...args).catch(handleError);
  };
}
