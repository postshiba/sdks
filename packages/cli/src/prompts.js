// @ts-check

import * as clack from "@clack/prompts";
import { CancelError } from "./errors.js";

/**
 * @typedef {object} Prompts
 * @property {(opts: { message: string, placeholder?: string, defaultValue?: string }) => Promise<string>} text
 * @property {(opts: { message: string }) => Promise<string>} password
 * @property {(opts: { message: string, options: { value: string, label: string, hint?: string }[] }) => Promise<string>} select
 * @property {(opts: { message: string }) => Promise<boolean>} confirm
 * @property {(message: string) => void} intro
 * @property {(message: string) => void} outro
 * @property {(message: string, title?: string) => void} note
 * @property {() => { start: (message?: string) => void, stop: (message?: string) => void }} spinner
 * @property {(message: string) => void} [cancel]
 * @property {{ success: (message: string) => void, error: (message: string) => void, info: (message: string) => void }} [log]
 */

/**
 * @param {unknown} value
 */
function unwrap(value) {
  if (clack.isCancel(value)) throw new CancelError();
  return value;
}

/** @returns {Prompts} */
export function createClackPrompts() {
  return {
    async text(opts) {
      return String(
        unwrap(
          await clack.text({
            message: opts.message,
            placeholder: opts.placeholder,
            defaultValue: opts.defaultValue,
          }),
        ),
      );
    },
    async password(opts) {
      return String(unwrap(await clack.password({ message: opts.message })));
    },
    async select(opts) {
      return String(
        unwrap(
          await clack.select({
            message: opts.message,
            options: opts.options,
          }),
        ),
      );
    },
    async confirm(opts) {
      return Boolean(unwrap(await clack.confirm({ message: opts.message })));
    },
    intro(message) {
      clack.intro(message);
    },
    outro(message) {
      clack.outro(message);
    },
    note(message, title) {
      clack.note(message, title);
    },
    spinner() {
      const spin = clack.spinner();
      return {
        start(message) {
          spin.start(message);
        },
        stop(message) {
          spin.stop(message);
        },
      };
    },
    cancel(message) {
      clack.cancel(message);
    },
    log: {
      success(message) {
        clack.log.success(message);
      },
      error(message) {
        clack.log.error(message);
      },
      info(message) {
        clack.log.info(message);
      },
    },
  };
}
