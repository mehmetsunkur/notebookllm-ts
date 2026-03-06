// Shared CLI option helpers for Commander.js commands.

import type { Command } from "commander";
import { NotebookLMClient } from "../api/client.ts";
import { getHomeDir, getStoragePath } from "../paths.ts";
import type { GlobalOptions } from "../types.ts";

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
 * Get the active notebook ID from context; throw if none set.
 */
export async function requireNotebookId(
  client: NotebookLMClient,
  notebookId?: string,
): Promise<string> {
  if (notebookId) return notebookId;
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
