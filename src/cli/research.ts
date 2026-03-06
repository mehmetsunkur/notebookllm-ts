// Research commands: status, wait

import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import ora from "ora";
import { makeClient, action, printOrJson, requireNotebookId } from "./options.ts";
import type { GlobalOptions } from "../types.ts";

export function buildResearchCommands(program: Command): void {
  const researchCmd = new Command("research").description("Manage research sources");

  // research status
  researchCmd
    .command("status")
    .description("Show current research status for the active notebook")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--json", "Output as JSON")
    .action(
      action(async (opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts<GlobalOptions>() ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const status = await client.research.status(notebookId);

        printOrJson(status, opts.json || globalOpts.json, (s) => {
          const statusColor =
            s.status === "complete"
              ? chalk.green(s.status)
              : s.status === "failed"
              ? chalk.red(s.status)
              : s.status === "running"
              ? chalk.yellow(s.status)
              : s.status;

          console.log(`Status: ${statusColor}`);
          if (s.query) console.log(`Query:  ${s.query}`);

          if (s.sources && s.sources.length > 0) {
            const table = new Table({
              head: [chalk.bold("ID"), chalk.bold("Title"), chalk.bold("Status"), chalk.bold("URL")],
            });
            for (const src of s.sources) {
              table.push([src.id, src.title, src.status, src.url.slice(0, 50)]);
            }
            console.log(table.toString());
          }
        });
      }),
    );

  // research wait
  researchCmd
    .command("wait")
    .description("Wait for research to complete")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--timeout <seconds>", "Timeout in seconds", "600")
    .option("--import-all", "Import all found sources into notebook")
    .option("--json", "Output as JSON")
    .action(
      action(async (opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts<GlobalOptions>() ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);

        const spinner = ora("Waiting for research to complete...").start();
        const status = await client.research.wait(notebookId, {
          timeoutMs: parseInt(opts.timeout, 10) * 1000,
          importAll: opts.importAll,
        });
        spinner.succeed(`Research ${status.status}.`);

        printOrJson(status, opts.json || globalOpts.json, (s) => {
          console.log(`Status: ${s.status}`);
          const count = s.sources?.length ?? 0;
          console.log(`Sources: ${count}`);
        });
      }),
    );

  program.addCommand(researchCmd);
}
