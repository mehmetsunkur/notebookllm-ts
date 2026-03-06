// Share commands: status, public, view-level, add, update, remove

import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import { makeClient, action, printOrJson, requireNotebookId } from "./options.ts";
import type { GlobalOptions, Permission } from "../types.ts";

export function buildShareCommands(program: Command): void {
  const shareCmd = new Command("share").description("Manage notebook sharing settings");

  // share status
  shareCmd
    .command("status")
    .description("Show sharing settings for the active notebook")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--json", "Output as JSON")
    .action(
      action(async (opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const settings = await client.sharing.status(notebookId);

        printOrJson(settings, opts.json || globalOpts.json, (s) => {
          console.log(`Public: ${s.isPublic ? chalk.green("yes") : chalk.red("no")}`);
          if (s.shareLink) console.log(`Link:   ${s.shareLink}`);
          if (s.viewLevel) console.log(`Level:  ${s.viewLevel}`);

          if (s.collaborators && s.collaborators.length > 0) {
            const table = new Table({
              head: [chalk.bold("Email"), chalk.bold("Permission"), chalk.bold("Added")],
            });
            for (const c of s.collaborators) {
              table.push([
                c.email,
                c.permission,
                c.addedMs ? new Date(c.addedMs).toLocaleDateString() : "-",
              ]);
            }
            console.log(table.toString());
          }
        });
      }),
    );

  // share public
  shareCmd
    .command("public")
    .description("Set public sharing for the active notebook")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--enable", "Enable public sharing")
    .option("--disable", "Disable public sharing")
    .option("--json", "Output as JSON")
    .action(
      action(async (opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const enable = opts.enable === true || opts.disable !== true;
        const settings = await client.sharing.setPublic(notebookId, enable);
        printOrJson(settings, opts.json || globalOpts.json, (s) => {
          console.log(chalk.green(`Public sharing ${s.isPublic ? "enabled" : "disabled"}.`));
          if (s.shareLink) console.log(`Link: ${s.shareLink}`);
        });
      }),
    );

  // share view-level <level>
  shareCmd
    .command("view-level <level>")
    .description("Set the default view level (view|comment|edit)")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--json", "Output as JSON")
    .action(
      action(async (level, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const settings = await client.sharing.setViewLevel(
          notebookId,
          level as "view" | "comment" | "edit",
        );
        printOrJson(settings, opts.json || globalOpts.json, (s) => {
          console.log(chalk.green(`View level set to: ${s.viewLevel}`));
        });
      }),
    );

  // share add <email>
  shareCmd
    .command("add <email>")
    .description("Add a collaborator to the active notebook")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--permission <perm>", "Permission level: viewer|commenter|editor", "viewer")
    .option("--no-notify", "Do not send email notification")
    .option("--json", "Output as JSON")
    .action(
      action(async (email, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const settings = await client.sharing.addCollaborator(notebookId, email, {
          permission: opts.permission as Permission,
          notify: opts.notify !== false,
        });
        printOrJson(settings, opts.json || globalOpts.json, () => {
          console.log(chalk.green(`Added ${email} as ${opts.permission}.`));
        });
      }),
    );

  // share update <email>
  shareCmd
    .command("update <email>")
    .description("Update a collaborator's permission")
    .option("-n, --notebook <id>", "Notebook ID")
    .requiredOption("--permission <perm>", "Permission level: viewer|commenter|editor")
    .option("--json", "Output as JSON")
    .action(
      action(async (email, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const settings = await client.sharing.updateCollaborator(
          notebookId,
          email,
          opts.permission as Permission,
        );
        printOrJson(settings, opts.json || globalOpts.json, () => {
          console.log(chalk.green(`Updated ${email} to ${opts.permission}.`));
        });
      }),
    );

  // share remove <email>
  shareCmd
    .command("remove <email>")
    .description("Remove a collaborator from the active notebook")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("-y, --yes", "Skip confirmation")
    .option("--json", "Output as JSON")
    .action(
      action(async (email, opts, cmd) => {
        const globalOpts = cmd.parent?.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);

        if (!opts.yes) {
          const { createInterface } = await import("readline");
          const rl = createInterface({ input: process.stdin, output: process.stdout });
          const answer = await new Promise<string>((resolve) =>
            rl.question(`Remove ${email} from notebook? (y/N) `, resolve),
          );
          rl.close();
          if (answer.toLowerCase() !== "y") {
            console.log("Cancelled.");
            return;
          }
        }

        await client.sharing.removeCollaborator(notebookId, email);
        console.log(chalk.green(`Removed ${email}.`));
      }),
    );

  program.addCommand(shareCmd);
}
