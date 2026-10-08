// @ts-check

import { actionsFor, resources } from "./commands.js";
import { hasSavedKey } from "./login.js";
import { colorsFor, wordmark } from "./render.js";

/**
 * @param {object} ctx
 * @param {import("./prompts.js").Prompts} ctx.prompts
 * @param {boolean} ctx.interactive
 * @param {{ write: (chunk: string) => unknown }} ctx.stdout
 * @param {NodeJS.ProcessEnv} ctx.env
 * @param {string} [ctx.configDir]
 * @param {boolean} [ctx.isTTY]
 * @param {(choice: string, action?: string) => Promise<number>} runChoice
 */
export async function mainMenu(ctx, runChoice) {
  const c = colorsFor(ctx);
  ctx.prompts.intro(wordmark(c));
  const signedIn = await hasSavedKey(ctx);
  const choice = await ctx.prompts.select({
    message: "What do you want to do?",
    options: [
      { value: "send", label: "Send an email" },
      { value: "sending-domains", label: "Add a sending domain" },
      { value: "clusters", label: "Clusters" },
      { value: "inboxes", label: "Inboxes" },
      { value: "templates", label: "Templates" },
      { value: "events", label: "Events" },
      { value: "webhooks", label: "Webhooks" },
      { value: "doctor", label: "Check my setup" },
      { value: signedIn ? "logout" : "login", label: signedIn ? "Sign out" : "Sign in" },
      { value: "skills", label: "Install the agent skill" },
      { value: "quit", label: "Quit" },
    ],
  });
  if (choice === "quit") {
    ctx.prompts.outro("Later.");
    return 0;
  }
  if (choice === "sending-domains") return runChoice("sending-domains", "create");
  if (resources().includes(choice)) {
    const rows = actionsFor(choice);
    const action = await ctx.prompts.select({
      message: `${choice}`,
      options: rows.map((row) => ({ value: row.action, label: row.action })),
    });
    return runChoice(choice, action);
  }
  return runChoice(choice);
}
