// Source commands: list, add, get, delete, rename, refresh, fulltext, guide, wait

import { Command, Option } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import ora from "ora";
import { makeClient, action, printOrJson, requireNotebookId, resolveSourceId } from "./options.ts";
import type { GlobalOptions } from "../types.ts";

export function buildSourceCommands(program: Command): void {
  const sourceCmd = new Command("source").description("Manage notebook sources");

  // source list
  sourceCmd
    .command("list")
    .description("List sources in the active notebook")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--json", "Output as JSON")
    .action(
      action(async (opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const sources = await client.sources.list(notebookId);

        printOrJson(sources, opts.json || globalOpts.json, (data) => {
          if (data.length === 0) {
            console.log(chalk.dim("No sources."));
            return;
          }
          const table = new Table({
            head: [chalk.bold("ID"), chalk.bold("Title"), chalk.bold("Type"), chalk.bold("Status")],
          });
          for (const s of data) {
            table.push([s.id, s.title, s.type ?? "-", statusColor(s.status)]);
          }
          console.log(table.toString());
        });
      }),
    );

  // source add <url|file|text>
  sourceCmd
    .command("add <value>")
    .description("Add a source (URL, file path, or text content)")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--title <title>", "Source title (for text sources)")
    .option("--type <type>", "Force type: url|file|text")
    .option("--no-wait", "Do not wait for processing to complete")
    .option("--json", "Output as JSON")
    .action(
      action(async (value, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);

        const spinner = ora("Adding source...").start();
        let source;
        try {
          const type = opts.type ?? detectSourceType(value);
          if (type === "file") {
            source = await client.sources.addFile(notebookId, value, opts.title);
          } else if (type === "text") {
            source = await client.sources.addText(notebookId, opts.title ?? "Text", value);
          } else {
            source = await client.sources.addUrl(notebookId, value);
          }
          spinner.succeed("Source added.");
        } catch (e) {
          spinner.fail("Failed to add source.");
          throw e;
        }

        if (opts.wait !== false && source.status !== "ready") {
          const waitSpinner = ora("Waiting for source to process...").start();
          try {
            source = await client.sources.wait(notebookId, source.id);
            waitSpinner.succeed("Source ready.");
          } catch (e) {
            waitSpinner.fail("Source processing failed.");
            throw e;
          }
        }

        printOrJson(source, opts.json || globalOpts.json, (s) => {
          console.log(`ID:     ${s.id}`);
          console.log(`Title:  ${s.title}`);
          console.log(`Status: ${statusColor(s.status)}`);
        });
      }),
    );

  // source add-drive <id> <title>
  const DRIVE_MIME_TYPES: Record<string, string> = {
    "google-doc": "application/vnd.google-apps.document",
    "google-slides": "application/vnd.google-apps.presentation",
    "google-sheets": "application/vnd.google-apps.spreadsheet",
    "pdf": "application/pdf",
  };

  sourceCmd
    .command("add-drive <driveId> <title>")
    .description("Add a Google Drive document as a source")
    .option("-n, --notebook <id>", "Notebook ID")
    .addOption(new Option("--mime-type <type>", "Document type").choices(["google-doc", "google-slides", "google-sheets", "pdf"]).default("google-doc"))
    .option("--json", "Output as JSON")
    .action(
      action(async (driveId, title, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const mimeType = DRIVE_MIME_TYPES[opts.mimeType];
        const source = await client.sources.addDrive(notebookId, driveId, title, mimeType);
        printOrJson(source, opts.json || globalOpts.json, (s) => {
          console.log(chalk.green(`Drive source added: ${s.id}`));
        });
      }),
    );

  // source add-url <url>
  sourceCmd
    .command("add-url <url>")
    .description("Add a URL source")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--no-wait", "Do not wait for processing")
    .option("--json", "Output as JSON")
    .action(
      action(async (url, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        let source = await client.sources.addUrl(notebookId, url);
        if (opts.wait !== false && source.id) {
          source = await client.sources.wait(notebookId, source.id);
        }
        printOrJson(source, opts.json || globalOpts.json, (s) => {
          console.log(chalk.green(`URL source added: ${s.id}`));
        });
      }),
    );

  // source add-text
  sourceCmd
    .command("add-text")
    .description("Add a text source")
    .requiredOption("--title <title>", "Source title")
    .requiredOption("--content <content>", "Source content")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--no-wait", "Do not wait for processing")
    .option("--json", "Output as JSON")
    .action(
      action(async (opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        let source = await client.sources.addText(notebookId, opts.title, opts.content);
        if (opts.wait !== false && source.id) {
          source = await client.sources.wait(notebookId, source.id);
        }
        printOrJson(source, opts.json || globalOpts.json, (s) => {
          console.log(chalk.green(`Text source added: ${s.id}`));
        });
      }),
    );

  // source add-file <path>
  sourceCmd
    .command("add-file <filePath>")
    .description("Add a file source")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--title <title>", "Override source title")
    .option("--no-wait", "Do not wait for processing")
    .option("--json", "Output as JSON")
    .action(
      action(async (filePath, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        let source = await client.sources.addFile(notebookId, filePath, opts.title);
        if (opts.wait !== false && source.id) {
          source = await client.sources.wait(notebookId, source.id);
        }
        printOrJson(source, opts.json || globalOpts.json, (s) => {
          console.log(chalk.green(`File source added: ${s.id}`));
        });
      }),
    );

  // source add-research <query>
  sourceCmd
    .command("add-research <query>")
    .description("Search web or drive and add sources from results")
    .option("-n, --notebook <id>", "Notebook ID")
    .addOption(new Option("--from <backend>", "Search backend").choices(["web", "drive"]).default("web"))
    .addOption(new Option("--mode <mode>", "Search mode").choices(["fast", "deep"]).default("fast"))
    .option("--import-all", "Import all research results")
    .option("--no-wait", "Start research and return immediately")
    .option("--json", "Output as JSON")
    .action(
      action(async (query, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const source = await client.sources.addResearch(notebookId, query, {
          mode: opts.mode,
          source: opts.from,
          importAll: opts.importAll,
        });
        printOrJson(source, opts.json || globalOpts.json, (s) => {
          console.log(chalk.green(`Research source added: ${s.id}`));
        });
      }),
    );

  // source get <id>
  sourceCmd
    .command("get <sourceId>")
    .description("Get details of a source")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--json", "Output as JSON")
    .action(
      action(async (sourceId, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const resolvedId = await resolveSourceId(client, notebookId, sourceId);
        const source = await client.sources.get(notebookId, resolvedId);
        printOrJson(source, opts.json || globalOpts.json, (s) => {
          console.log(`ID:     ${s.id}`);
          console.log(`Title:  ${s.title}`);
          console.log(`Type:   ${s.type ?? "-"}`);
          console.log(`Status: ${statusColor(s.status)}`);
          if (s.url) console.log(`URL:    ${s.url}`);
        });
      }),
    );

  // source fulltext <id>
  sourceCmd
    .command("fulltext <sourceId>")
    .description("Get the full text content of a source")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("-o, --output <path>", "Write content to file instead of stdout")
    .option("--json", "Output as JSON")
    .action(
      action(async (sourceId, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const resolvedId = await resolveSourceId(client, notebookId, sourceId);
        const result = await client.sources.fulltext(notebookId, resolvedId);

        if (opts.output) {
          await Bun.write(opts.output, result.content);
          console.log(chalk.green(`Saved ${result.content.length.toLocaleString()} chars to ${opts.output}`));
          return;
        }

        if (opts.json || globalOpts.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(result.content);
        }
      }),
    );

  // source guide <id>
  sourceCmd
    .command("guide <sourceId>")
    .description("Get the reading guide for a source")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--json", "Output as JSON")
    .action(
      action(async (sourceId, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const resolvedId = await resolveSourceId(client, notebookId, sourceId);
        const guide = await client.sources.guide(notebookId, resolvedId);
        if (opts.json || globalOpts.json) {
          console.log(JSON.stringify({ guide }, null, 2));
        } else {
          console.log(guide);
        }
      }),
    );

  // source rename <id> <title>
  sourceCmd
    .command("rename <sourceId> <title>")
    .description("Rename a source")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--json", "Output as JSON")
    .action(
      action(async (sourceId, title, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const resolvedId = await resolveSourceId(client, notebookId, sourceId);
        const source = await client.sources.rename(notebookId, resolvedId, title);
        printOrJson(source, opts.json || globalOpts.json, (s) => {
          console.log(chalk.green(`Renamed to: ${s.title}`));
        });
      }),
    );

  // source refresh <id>
  sourceCmd
    .command("refresh <sourceId>")
    .description("Refresh a source (re-fetch from URL)")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--json", "Output as JSON")
    .action(
      action(async (sourceId, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const resolvedId = await resolveSourceId(client, notebookId, sourceId);
        const source = await client.sources.refresh(notebookId, resolvedId);
        printOrJson(source, opts.json || globalOpts.json, (s) => {
          console.log(chalk.green(`Source refreshed: ${s.id}`));
        });
      }),
    );

  // source delete <id>
  sourceCmd
    .command("delete <sourceId>")
    .description("Delete a source")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("-y, --yes", "Skip confirmation")
    .action(
      action(async (sourceId, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const resolvedId = await resolveSourceId(client, notebookId, sourceId);

        if (!opts.yes) {
          const { createInterface } = await import("readline");
          const rl = createInterface({ input: process.stdin, output: process.stdout });
          const answer = await new Promise<string>((resolve) =>
            rl.question(`Delete source ${resolvedId}? (y/N) `, resolve),
          );
          rl.close();
          if (answer.toLowerCase() !== "y") {
            console.log("Cancelled.");
            return;
          }
        }

        await client.sources.delete(notebookId, resolvedId);
        console.log(chalk.green(`Source deleted: ${resolvedId}`));
      }),
    );

  // source wait <id>
  sourceCmd
    .command("wait <sourceId>")
    .description("Wait for a source to finish processing")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--timeout <seconds>", "Timeout in seconds", "300")
    .option("--json", "Output as JSON")
    .action(
      action(async (sourceId, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const resolvedId = await resolveSourceId(client, notebookId, sourceId);
        const spinner = ora("Waiting for source to process...").start();
        const source = await client.sources.wait(notebookId, resolvedId, {
          timeoutMs: parseInt(opts.timeout, 10) * 1000,
        });
        spinner.succeed("Source ready.");
        printOrJson(source, opts.json || globalOpts.json, (s) => {
          console.log(`Status: ${statusColor(s.status)}`);
        });
      }),
    );

  // source stale <id>
  sourceCmd
    .command("stale <sourceId>")
    .description("Check if a source is stale (exit 0 = stale, exit 1 = fresh)")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--json", "Output as JSON")
    .action(
      action(async (sourceId, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const resolvedId = await resolveSourceId(client, notebookId, sourceId);
        const fresh = await client.sources.checkFreshness(notebookId, resolvedId);

        if (opts.json || globalOpts.json) {
          console.log(JSON.stringify({ sourceId: resolvedId, stale: !fresh }));
        } else {
          console.log(fresh ? "fresh" : "stale");
        }

        // exit 0 = stale (truthy condition for shell if-then), exit 1 = fresh
        process.exit(fresh ? 1 : 0);
      }),
    );

  program.addCommand(sourceCmd);
}

function detectSourceType(value: string): "url" | "file" | "text" {
  if (value.startsWith("http://") || value.startsWith("https://")) return "url";
  // Check if it looks like a file path
  if (value.includes("/") || value.includes("\\") || value.includes(".")) {
    return "file";
  }
  return "text";
}

function statusColor(status: string | undefined): string {
  switch (status) {
    case "ready": return chalk.green(status ?? "-");
    case "processing": return chalk.yellow(status);
    case "failed": return chalk.red(status);
    default: return status ?? "-";
  }
}
