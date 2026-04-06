import chalk from 'chalk';
import { WALLET_DAT } from './constants.js';

export function banner(): void {
  console.log(chalk.bold.cyan('\n  CLI Wallet'));
  console.log(chalk.dim(`  Encrypted storage: ${WALLET_DAT}\n`));
}

export const ok = (msg: string) => console.log(chalk.green(`[ok] ${msg}`));
export const bad = (msg: string) => console.error(chalk.red(`[error] ${msg}`));
export const note = (msg: string) => console.log(chalk.dim(`  ${msg}`));
export const warn = (msg: string) => console.log(chalk.yellow(`  ${msg}`));
