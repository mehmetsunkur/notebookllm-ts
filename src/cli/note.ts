// Note commands: list, create, get, rename, delete, save

import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import { makeClient, action, printOrJson, requireNotebookId, resolveNoteId } from "./options.ts";
import type { GlobalOptions } from "../types.ts";

export function buildNoteCommands(program: Command): void {
  const noteCmd = new Command("note").description("Manage notebook notes");

  // note list
  noteCmd
    .command("list")
    .description("List notes in the active notebook")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--json", "Output as JSON")
    .action(
      action(async (opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const notes = await client.notes.list(notebookId);

        printOrJson(notes, opts.json || globalOpts.json, (data) => {
          if (data.length === 0) {
            console.log(chalk.dim("No notes."));
            return;
          }
          const table = new Table({
            head: [chalk.bold("ID"), chalk.bold("Title"), chalk.bold("Updated")],
          });
          for (const n of data) {
            table.push([
              n.id,
              n.title,
              n.updatedMs ? new Date(n.updatedMs).toLocaleDateString() : "-",
            ]);
          }
          console.log(table.toString());
        });
      }),
    );

  // note create <content>
  noteCmd
    .command("create [content]")
    .description("Create a new note")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--title <title>", "Note title")
    .option("--content <content>", "Note content")
    .option("--json", "Output as JSON")
    .action(
      action(async (contentArg, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const content = opts.content ?? contentArg ?? "";
        const title = opts.title ?? "New Note";
        const note = await client.notes.create(notebookId, content);
        if (title !== "New Note" && note.id) {
          await client.notes.rename(notebookId, note.id, title);
        }
        printOrJson(note, opts.json || globalOpts.json, (n) => {
          console.log(chalk.green(`Note created: ${n.id}`));
          console.log(`Title: ${n.title}`);
        });
      }),
    );

  // note get <id>
  noteCmd
    .command("get <noteId>")
    .description("Get a note's content")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--json", "Output as JSON")
    .action(
      action(async (noteId, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const resolvedId = await resolveNoteId(client, notebookId, noteId);
        const note = await client.notes.get(notebookId, resolvedId);
        printOrJson(note, opts.json || globalOpts.json, (n) => {
          console.log(chalk.bold(n.title));
          console.log(n.content);
        });
      }),
    );

  // note rename <id> <title>
  noteCmd
    .command("rename <noteId> <title>")
    .description("Rename a note")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--json", "Output as JSON")
    .action(
      action(async (noteId, title, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const resolvedId = await resolveNoteId(client, notebookId, noteId);
        const note = await client.notes.rename(notebookId, resolvedId, title);
        printOrJson(note, opts.json || globalOpts.json, (n) => {
          console.log(chalk.green(`Renamed to: ${n.title}`));
        });
      }),
    );

  // note delete <id>
  noteCmd
    .command("delete <noteId>")
    .description("Delete a note")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("-y, --yes", "Skip confirmation")
    .action(
      action(async (noteId, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const resolvedId = await resolveNoteId(client, notebookId, noteId);

        if (!opts.yes) {
          const { createInterface } = await import("readline");
          const rl = createInterface({ input: process.stdin, output: process.stdout });
          const answer = await new Promise<string>((resolve) =>
            rl.question(`Delete note ${resolvedId}? (y/N) `, resolve),
          );
          rl.close();
          if (answer.toLowerCase() !== "y") {
            console.log("Cancelled.");
            return;
          }
        }

        await client.notes.delete(notebookId, resolvedId);
        console.log(chalk.green(`Note deleted: ${resolvedId}`));
      }),
    );

  // note save <id>
  noteCmd
    .command("save <noteId> <content>")
    .description("Update the content of a note")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--json", "Output as JSON")
    .action(
      action(async (noteId, content, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const resolvedId = await resolveNoteId(client, notebookId, noteId);
        const note = await client.notes.save(notebookId, resolvedId, content);
        printOrJson(note, opts.json || globalOpts.json, (n) => {
          console.log(chalk.green(`Note saved: ${n.id}`));
        });
      }),
    );

  // note update <id>
  noteCmd
    .command("update <noteId>")
    .description("Update note title/content")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--title <title>", "New title")
    .option("--content <content>", "New content")
    .option("--json", "Output as JSON")
    .action(
      action(async (noteId, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const resolvedId = await resolveNoteId(client, notebookId, noteId);
        const current = await client.notes.get(notebookId, resolvedId);
        const updated = await client.notes.save(
          notebookId,
          resolvedId,
          opts.content ?? current.content,
        );
        const final = opts.title ? await client.notes.rename(notebookId, resolvedId, opts.title) : updated;
        printOrJson(final, opts.json || globalOpts.json, (n) => {
          console.log(chalk.green(`Note updated: ${n.id}`));
        });
      }),
    );

  program.addCommand(noteCmd);
}
