// Artifact commands: list, get, rename, delete, export, poll, wait, suggestions

import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import ora from "ora";
import { makeClient, action, printOrJson, requireNotebookId } from "./options.ts";
import type { GlobalOptions, ArtifactType } from "../types.ts";

export function buildArtifactCommands(program: Command): void {
  const artifactCmd = new Command("artifact").description("Manage generated artifacts");

  // artifact list
  artifactCmd
    .command("list")
    .description("List artifacts in the active notebook")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--type <type>", "Filter by artifact type")
    .option("--json", "Output as JSON")
    .action(
      action(async (opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts<GlobalOptions>() ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const artifacts = await client.artifacts.list(
          notebookId,
          opts.type as ArtifactType | undefined,
        );

        printOrJson(artifacts, opts.json || globalOpts.json, (data) => {
          if (data.length === 0) {
            console.log(chalk.dim("No artifacts."));
            return;
          }
          const table = new Table({
            head: [chalk.bold("ID"), chalk.bold("Type"), chalk.bold("Title"), chalk.bold("Status")],
          });
          for (const a of data) {
            const statusStr = a.status === "ready"
              ? chalk.green(a.status)
              : a.status === "failed"
              ? chalk.red(a.status)
              : chalk.yellow(a.status);
            table.push([a.id, a.type, a.title, statusStr]);
          }
          console.log(table.toString());
        });
      }),
    );

  // artifact get <id>
  artifactCmd
    .command("get <artifactId>")
    .description("Get details of an artifact")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--json", "Output as JSON")
    .action(
      action(async (artifactId, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts<GlobalOptions>() ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const artifact = await client.artifacts.get(notebookId, artifactId);
        printOrJson(artifact, opts.json || globalOpts.json, (a) => {
          console.log(`ID:      ${a.id}`);
          console.log(`Type:    ${a.type}`);
          console.log(`Title:   ${a.title}`);
          console.log(`Status:  ${a.status}`);
          if (a.taskId) console.log(`Task ID: ${a.taskId}`);
          if (a.downloadUrl) console.log(`URL:     ${a.downloadUrl}`);
        });
      }),
    );

  // artifact rename <id> <title>
  artifactCmd
    .command("rename <artifactId> <title>")
    .description("Rename an artifact")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--json", "Output as JSON")
    .action(
      action(async (artifactId, title, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts<GlobalOptions>() ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const artifact = await client.artifacts.rename(notebookId, artifactId, title);
        printOrJson(artifact, opts.json || globalOpts.json, (a) => {
          console.log(chalk.green(`Renamed to: ${a.title}`));
        });
      }),
    );

  // artifact delete <id>
  artifactCmd
    .command("delete <artifactId>")
    .description("Delete an artifact")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("-y, --yes", "Skip confirmation")
    .action(
      action(async (artifactId, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts<GlobalOptions>() ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);

        if (!opts.yes) {
          const { createInterface } = await import("readline");
          const rl = createInterface({ input: process.stdin, output: process.stdout });
          const answer = await new Promise<string>((resolve) =>
            rl.question(`Delete artifact ${artifactId}? (y/N) `, resolve),
          );
          rl.close();
          if (answer.toLowerCase() !== "y") {
            console.log("Cancelled.");
            return;
          }
        }

        await client.artifacts.delete(notebookId, artifactId);
        console.log(chalk.green(`Artifact deleted: ${artifactId}`));
      }),
    );

  // artifact export <id>
  artifactCmd
    .command("export <artifactId>")
    .description("Export an artifact")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--type <type>", "Export type")
    .option("--title <title>", "Export title")
    .option("--json", "Output as JSON")
    .action(
      action(async (artifactId, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts<GlobalOptions>() ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const result = await client.artifacts.export(
          notebookId,
          artifactId,
          opts.type,
          opts.title,
        );
        if (opts.json || globalOpts.json) {
          console.log(JSON.stringify({ result }, null, 2));
        } else {
          console.log(result);
        }
      }),
    );

  // artifact poll <taskId>
  artifactCmd
    .command("poll <taskId>")
    .description("Poll the status of an artifact generation task")
    .option("--json", "Output as JSON")
    .action(
      action(async (taskId, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts<GlobalOptions>() ?? {};
        const client = makeClient(globalOpts);
        const task = await client.artifacts.poll(taskId);
        printOrJson(task, opts.json || globalOpts.json, (t) => {
          console.log(`Task ID:     ${t.taskId}`);
          console.log(`Status:      ${t.status}`);
          if (t.artifactId) console.log(`Artifact ID: ${t.artifactId}`);
          if (t.progress !== undefined) console.log(`Progress:    ${t.progress}%`);
        });
      }),
    );

  // artifact wait <id>
  artifactCmd
    .command("wait <artifactId>")
    .description("Wait for an artifact to be ready")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--timeout <seconds>", "Timeout in seconds", "600")
    .option("--interval <seconds>", "Poll interval in seconds", "5")
    .option("--json", "Output as JSON")
    .action(
      action(async (artifactId, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts<GlobalOptions>() ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);

        const spinner = ora("Waiting for artifact...").start();
        const artifact = await client.artifacts.wait(notebookId, artifactId, {
          timeoutMs: parseInt(opts.timeout, 10) * 1000,
          intervalMs: parseInt(opts.interval, 10) * 1000,
        });
        spinner.succeed("Artifact is ready.");
        printOrJson(artifact, opts.json || globalOpts.json, (a) => {
          console.log(`ID:    ${a.id}`);
          console.log(`Type:  ${a.type}`);
          console.log(`Title: ${a.title}`);
        });
      }),
    );

  // artifact suggestions
  artifactCmd
    .command("suggestions")
    .description("Get artifact generation suggestions for the active notebook")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("-s, --source <id...>", "Limit to specific source IDs")
    .option("--json", "Output as JSON")
    .action(
      action(async (opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts<GlobalOptions>() ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const suggestions = await client.artifacts.suggestions(notebookId, opts.source);

        printOrJson(suggestions, opts.json || globalOpts.json, (data) => {
          if (data.length === 0) {
            console.log(chalk.dim("No suggestions."));
            return;
          }
          for (const s of data) console.log(`  • ${s}`);
        });
      }),
    );

  program.addCommand(artifactCmd);
}
