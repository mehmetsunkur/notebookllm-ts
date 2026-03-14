// Language commands: list, get, set

import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import { makeClient, action, printOrJson, requireNotebookId } from "./options.js";
import type { GlobalOptions } from "../types.js";

export function buildLanguageCommands(program: Command): void {
  const langCmd = new Command("language").description("Manage notebook language settings");

  // language list
  langCmd
    .command("list")
    .description("List all available languages")
    .option("--json", "Output as JSON")
    .action(
      action(async (opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const languages = await client.settings.listLanguages();

        printOrJson(languages, opts.json || globalOpts.json, (data) => {
          const table = new Table({ head: [chalk.bold("Code"), chalk.bold("Name")] });
          for (const lang of data) table.push([lang.code, lang.name]);
          console.log(table.toString());
        });
      }),
    );

  // language get
  langCmd
    .command("get")
    .description("Get the current language for the active notebook")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--local", "Show local config language only")
    .option("--json", "Output as JSON")
    .action(
      action(async (opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);

        let language: string;

        if (opts.local) {
          language = (await client.settings.getLocalLanguage()) ?? "not set";
        } else {
          const notebookId = await requireNotebookId(client, opts.notebook);
          language = await client.settings.getLanguage(notebookId);
        }

        if (opts.json || globalOpts.json) {
          console.log(JSON.stringify({ language }, null, 2));
        } else {
          console.log(`Language: ${language}`);
        }
      }),
    );

  // language set <code>
  langCmd
    .command("set <code>")
    .description("Set the language for the active notebook")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--local", "Set in local config only (does not update notebook on server)")
    .action(
      action(async (code, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);

        if (opts.local) {
          await client.settings.setLocalLanguage(code);
          console.log(chalk.green(`Local language set to: ${code}`));
        } else {
          const notebookId = await requireNotebookId(client, opts.notebook);
          await client.settings.setLanguage(notebookId, code);
          console.log(chalk.green(`Notebook language set to: ${code}`));
        }
      }),
    );

  program.addCommand(langCmd);
}
