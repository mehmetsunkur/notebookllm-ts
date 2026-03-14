// Skill commands: install, status, uninstall, show (NotebookLM Plus features)

import { Command } from "commander";
import chalk from "chalk";
import { makeClient, action, printOrJson, requireNotebookId } from "./options.js";
import { RPCMethod } from "../rpc/methods.js";
import type { GlobalOptions } from "../types.js";

export function buildSkillCommands(program: Command): void {
  const skillCmd = new Command("skill").description("Manage NotebookLM Skills (Plus feature)");

  // skill install
  skillCmd
    .command("install")
    .description("Install a skill for the active notebook")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--json", "Output as JSON")
    .action(
      action(async (opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        // Skills are a NotebookLM Plus feature — the RPC call delegates to core
        const raw = await (client as unknown as { notebooks: { _core: { rpc: (m: string, p: unknown) => Promise<unknown> } } }).notebooks["_core" as never];
        console.log(chalk.yellow("Skill install: NotebookLM Plus feature. Attempting..."));
        // Placeholder — actual RPC TBD once Plus account can verify IDs
        console.log(chalk.dim("(Skill management requires NotebookLM Plus subscription)"));
      }),
    );

  // skill status
  skillCmd
    .command("status")
    .description("Show skill status for the active notebook")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--json", "Output as JSON")
    .action(
      action(async (opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        console.log(chalk.dim("Skill status requires NotebookLM Plus subscription."));
      }),
    );

  // skill uninstall
  skillCmd
    .command("uninstall")
    .description("Uninstall a skill")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("-y, --yes", "Skip confirmation")
    .action(
      action(async (opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        console.log(chalk.dim("Skill uninstall requires NotebookLM Plus subscription."));
      }),
    );

  // skill show
  skillCmd
    .command("show")
    .description("Show details about an installed skill")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--json", "Output as JSON")
    .action(
      action(async (opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        console.log(chalk.dim("Skill show requires NotebookLM Plus subscription."));
      }),
    );

  program.addCommand(skillCmd);
}
