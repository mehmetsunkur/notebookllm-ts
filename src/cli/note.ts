// Note commands: list, create, get, rename, delete, save

import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import { makeClient, action, printOrJson, requireNotebookId } from "./options.ts";
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
        const globalOpts = cmd.parent?.parent?.opts<GlobalOptions>() ?? {};
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
    .command("create <content>")
    .description("Create a new note")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--json", "Output as JSON")
    .action(
      action(async (content, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts<GlobalOptions>() ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const note = await client.notes.create(notebookId, content);
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
        const globalOpts = cmd.parent?.parent?.opts<GlobalOptions>() ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const note = await client.notes.get(notebookId, noteId);
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
        const globalOpts = cmd.parent?.parent?.opts<GlobalOptions>() ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const note = await client.notes.rename(notebookId, noteId, title);
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
        const globalOpts = cmd.parent?.parent?.opts<GlobalOptions>() ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);

        if (!opts.yes) {
          const { createInterface } = await import("readline");
          const rl = createInterface({ input: process.stdin, output: process.stdout });
          const answer = await new Promise<string>((resolve) =>
            rl.question(`Delete note ${noteId}? (y/N) `, resolve),
          );
          rl.close();
          if (answer.toLowerCase() !== "y") {
            console.log("Cancelled.");
            return;
          }
        }

        await client.notes.delete(notebookId, noteId);
        console.log(chalk.green(`Note deleted: ${noteId}`));
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
        const globalOpts = cmd.parent?.parent?.opts<GlobalOptions>() ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const note = await client.notes.save(notebookId, noteId, content);
        printOrJson(note, opts.json || globalOpts.json, (n) => {
          console.log(chalk.green(`Note saved: ${n.id}`));
        });
      }),
    );

  program.addCommand(noteCmd);
}
