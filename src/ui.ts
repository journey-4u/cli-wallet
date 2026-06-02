import chalk from 'chalk';
import { WALLET_DAT } from './constants.js';

export function banner(): void {
  console.log(chalk.bold.cyan('\n  CLI 👛'));
  console.log(chalk.dim(`  Encrypted storage: ${WALLET_DAT}\n`));
}

// Mask the middle 16 characters of an address with '*', keeping the
// head and tail visible. Used everywhere an address is shown except the
// dedicated "show address" action.
export function maskAddress(addr: string): string {
  const MASK_LEN = 16;
  if (addr.length <= MASK_LEN) return '*'.repeat(addr.length);
  const keep = addr.length - MASK_LEN;
  const head = Math.ceil(keep / 2);
  const tail = keep - head;
  return addr.slice(0, head) + '*'.repeat(MASK_LEN) + addr.slice(addr.length - tail);
}

export const ok = (msg: string) => console.log(chalk.green(`[ok] ${msg}`));
export const bad = (msg: string) => console.error(chalk.red(`[error] ${msg}`));
export const note = (msg: string) => console.log(chalk.dim(`  ${msg}`));
export const warn = (msg: string) => console.log(chalk.yellow(`  ${msg}`));
