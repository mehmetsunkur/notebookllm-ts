// Chat commands: ask, history, configure

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { makeClient, action, printOrJson, requireNotebookId } from "./options.ts";
import type { GlobalOptions } from "../types.ts";

export function buildChatCommands(program: Command): void {
  // ask <question>
  program
    .command("ask <question>")
    .description("Ask a question about the active notebook")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("-s, --source <id...>", "Limit to specific source IDs")
    .option("--save-as-note", "Save the response as a note")
    .option("--json", "Output as JSON")
    .action(
      action(async (question, opts, cmd) => {
        const globalOpts = cmd.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const ctx = await client.loadContext();

        const spinner = ora("Thinking...").start();
        let response;
        try {
          response = await client.chat.ask(notebookId, question, {
            conversationId: ctx.conversationId,
            sourceIds: opts.source,
            saveAsNote: opts.saveAsNote,
          });
          spinner.stop();
        } catch (e) {
          spinner.fail("Failed.");
          throw e;
        }

        // Save conversation ID for context continuity
        if (response.conversationId) {
          await client.saveContext({ ...ctx, notebookId, conversationId: response.conversationId });
        }

        printOrJson(response, opts.json || globalOpts.json, (r) => {
          console.log(r.answer);
          if (r.followUpQuestions?.length) {
            console.log(chalk.dim("\nSuggested follow-ups:"));
            for (const q of r.followUpQuestions) {
              console.log(chalk.dim(`  • ${q}`));
            }
          }
        });
      }),
    );

  // history
  program
    .command("history")
    .description("Show chat history for the active notebook")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--clear", "Clear chat history")
    .option("--save", "Save history to a note")
    .option("--show-all", "Show all messages including system messages")
    .option("--json", "Output as JSON")
    .action(
      action(async (opts, cmd) => {
        const globalOpts = cmd.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);
        const ctx = await client.loadContext();

        if (opts.clear) {
          await client.chat.clearHistory(notebookId, ctx.conversationId);
          await client.saveContext({ ...ctx, conversationId: undefined });
          console.log(chalk.green("Chat history cleared."));
          return;
        }

        const messages = await client.chat.history(notebookId, ctx.conversationId);

        printOrJson(messages, opts.json || globalOpts.json, (msgs) => {
          if (msgs.length === 0) {
            console.log(chalk.dim("No chat history."));
            return;
          }
          for (const msg of msgs) {
            const label = msg.role === "user" ? chalk.cyan("You:") : chalk.green("NotebookLM:");
            console.log(`\n${label}`);
            console.log(msg.content);
          }
        });
      }),
    );

  // configure
  program
    .command("configure")
    .description("Configure chat settings (persona/mode)")
    .option("-n, --notebook <id>", "Notebook ID")
    .option("--mode <mode>", "Chat persona mode")
    .action(
      action(async (opts, cmd) => {
        const globalOpts = cmd.parent?.opts() as GlobalOptions ?? {};
        const client = makeClient(globalOpts);
        const notebookId = await requireNotebookId(client, opts.notebook);

        if (!opts.mode) {
          console.error("Specify a mode with --mode <mode>");
          process.exit(1);
        }

        await client.chat.configure(notebookId, opts.mode);
        console.log(chalk.green(`Chat mode set to: ${opts.mode}`));
      }),
    );
}
