// Notebook commands: list, create, delete, rename, summary, share

import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import { makeClient, action, printOrJson, requireNotebookId } from "./options.ts";
import type { GlobalOptions, Notebook } from "../types.ts";

export function buildNotebookCommands(program: Command): void {
  // list
  program
    .command("list")
    .description("List all notebooks")
    .option("--json", "Output as JSON")
    .action(
      action(async (opts, cmd) => {
        const globalOpts = cmd.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebooks = await client.notebooks.list();

        printOrJson(notebooks, opts.json || globalOpts.json, (data) => {
          if (data.length === 0) {
            console.log(chalk.dim("No notebooks found."));
            return;
          }
          const table = new Table({
            head: [chalk.bold("ID"), chalk.bold("Title"), chalk.bold("Sources"), chalk.bold("Updated")],
            style: { compact: true },
          });
          for (const nb of data) {
            table.push([
              nb.id,
              nb.title,
              String(nb.sourceCount ?? "-"),
              nb.updatedMs ? new Date(nb.updatedMs).toLocaleDateString() : "-",
            ]);
          }
          console.log(table.toString());
        });
      }),
    );

  // create <title>
  program
    .command("create <title>")
    .description("Create a new notebook")
    .option("--json", "Output as JSON")
    .action(
      action(async (title, opts, cmd) => {
        const globalOpts = cmd.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebook = await client.notebooks.create(title);

        printOrJson(notebook, opts.json || globalOpts.json, (nb) => {
          console.log(chalk.green(`Notebook created: ${nb.title}`));
          console.log(`ID: ${nb.id}`);
        });
      }),
    );

  // delete <id>
  program
    .command("delete <id>")
    .description("Delete a notebook")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(
      action(async (id, opts, cmd) => {
        const globalOpts = cmd.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);

        if (!opts.yes) {
          const { createInterface } = await import("readline");
          const rl = createInterface({ input: process.stdin, output: process.stdout });
          const answer = await new Promise<string>((resolve) =>
            rl.question(`Delete notebook ${id}? (y/N) `, resolve),
          );
          rl.close();
          if (answer.toLowerCase() !== "y") {
            console.log("Cancelled.");
            return;
          }
        }

        await client.notebooks.delete(id);
        console.log(chalk.green(`Notebook deleted: ${id}`));
      }),
    );

  // rename <title>
  program
    .command("rename <title>")
    .description("Rename the active notebook")
    .option("-n, --notebook <id>", "Notebook ID (overrides active context)")
    .option("--json", "Output as JSON")
    .action(
      action(async (title, opts, cmd) => {
        const globalOpts = cmd.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const notebook = await client.notebooks.rename(notebookId, title);

        printOrJson(notebook, opts.json || globalOpts.json, (nb) => {
          console.log(chalk.green(`Renamed to: ${nb.title}`));
        });
      }),
    );

  // summary
  program
    .command("summary")
    .description("Get the AI-generated summary of the active notebook")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--json", "Output as JSON")
    .action(
      action(async (opts, cmd) => {
        const globalOpts = cmd.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const summary = await client.notebooks.summary(notebookId);

        if (opts.json || globalOpts.json) {
          console.log(JSON.stringify({ summary }, null, 2));
        } else {
          console.log(summary);
        }
      }),
    );

}
