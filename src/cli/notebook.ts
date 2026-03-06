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

  // delete
  program
    .command("delete")
    .description("Delete a notebook")
    .option("-n, --notebook <id>", "Notebook ID (uses current if not set). Supports partial IDs.")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(
      action(async (opts, cmd) => {
        const globalOpts = cmd.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);

        if (!opts.yes) {
          const { createInterface } = await import("readline");
          const rl = createInterface({ input: process.stdin, output: process.stdout });
          const answer = await new Promise<string>((resolve) =>
            rl.question(`Delete notebook ${notebookId}? (y/N) `, resolve),
          );
          rl.close();
          if (answer.toLowerCase() !== "y") {
            console.log("Cancelled.");
            return;
          }
        }

        await client.notebooks.delete(notebookId);
        console.log(chalk.green(`Notebook deleted: ${notebookId}`));

        // Clear context if we just deleted the active notebook
        const ctx = await client.loadContext();
        if (ctx.notebookId === notebookId) {
          await client.clearContext();
          console.log(chalk.dim("Cleared current notebook context."));
        }
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
    .option("--topics", "Include AI-suggested follow-up topics")
    .option("--json", "Output as JSON")
    .action(
      action(async (opts, cmd) => {
        const globalOpts = cmd.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const description = await client.notebooks.getDescription(notebookId);

        if (opts.json || globalOpts.json) {
          const data: Record<string, unknown> = { summary: description.summary };
          if (opts.topics) data.suggestedTopics = description.suggestedTopics;
          console.log(JSON.stringify(data, null, 2));
          return;
        }

        if (description.summary) {
          console.log(chalk.bold("Summary:"));
          console.log(description.summary);
        } else {
          console.log(chalk.dim("No summary available."));
        }

        if (opts.topics && description.suggestedTopics.length > 0) {
          console.log();
          console.log(chalk.bold("Suggested Topics:"));
          description.suggestedTopics.forEach((t, i) => {
            console.log(`  ${i + 1}. ${t.question}`);
          });
        }
      }),
    );

}
