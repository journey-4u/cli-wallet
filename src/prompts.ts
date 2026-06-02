import { Separator } from '@inquirer/core';
import { confirm, input, password, select } from '@inquirer/prompts';
import { ethers } from 'ethers';
import { CHAIN_PRESETS } from './chains.js';
import type { TokenSymbol } from './chains.js';
import { WALLET_DAT } from './constants.js';
import { findWallet, loadWalletFile } from './storage.js';
import { bad, maskAddress } from './ui.js';

export type MenuAction =
  | 'create'
  | 'import'
  | 'list'
  | 'address'
  | 'seed'
  | 'sendNative'
  | 'sendToken'
  | 'delete'
  | 'exit';

export async function promptMenu(): Promise<MenuAction | null> {
  try {
    return await select<MenuAction>({
      message: 'What do you want to do?',
      pageSize: 14,
      loop: true,
      choices: [
        { value: 'create', name: 'Create a new 👛' },
        { value: 'import', name: 'Import 👛 from 🌱' },
        { value: 'list', name: 'List 👛' },
        new Separator('─'),
        { value: 'address', name: 'Show 📫' },
        { value: 'seed', name: 'Show 🌱' },
        new Separator('─'),
        { value: 'sendNative', name: 'Send 🪙' },
        { value: 'sendToken', name: 'Send 💵' },
        new Separator('─'),
        { value: 'delete', name: 'Delete 👛' },
        { value: 'exit', name: 'Exit' },
      ],
    });
  } catch {
    return null;
  }
}

export async function pickWallet(heading: string): Promise<string | null> {
  const data = loadWalletFile(WALLET_DAT);
  const names = data.wallets.map((w) => w.name);
  if (names.length === 0) {
    bad('No saved 👛 yet. Create or import one first.');
    return null;
  }
  try {
    const choice = await select<string>({
      message: heading,
      pageSize: 12,
      choices: [
        ...names.map((n) => ({ value: n, name: n })),
        new Separator(),
        { value: '__other', name: 'Enter another name…' },
      ],
    });
    if (choice === '__other') {
      const name = await input({
        message: '👛 name:',
        validate: (v) => v.trim().length > 0 || 'Name is required',
      });
      const trimmed = name.trim();
      if (!findWallet(data, trimmed)) {
        bad(`No 👛 named "${trimmed}".`);
        return null;
      }
      return trimmed;
    }
    return choice;
  } catch {
    return null;
  }
}

export async function askNewWalletName(): Promise<string | null> {
  try {
    const name = await input({
      message: '👛 name (label on this device only):',
      validate: (v) => v.trim().length > 0 || 'Name is required',
    });
    return name.trim();
  } catch {
    return null;
  }
}

export async function askPasswordLine(message: string): Promise<string | null> {
  try {
    const p = await password({
      message,
      mask: '*',
    });
    return p;
  } catch {
    return null;
  }
}

export async function askMnemonic(): Promise<string | null> {
  try {
    const phrase = await input({
      message: '🌱 (12 or 24 words — paste is OK):',
      validate: (v) => v.trim().length > 0 || 'Required',
    });
    return phrase;
  } catch {
    return null;
  }
}

export async function confirmDelete(name: string): Promise<boolean | null> {
  try {
    return await confirm({
      message: `Remove "${name}" from this device only?`,
      default: false,
    });
  } catch {
    return null;
  }
}

export async function inputRpc(defaultUrl: string): Promise<string | null> {
  try {
    const rpc = await input({
      message: '🌐 URL:',
      default: defaultUrl,
    });
    return rpc.trim() || defaultUrl;
  } catch {
    return null;
  }
}

export async function inputAddress(message: string): Promise<string | null> {
  try {
    const raw = await input({
      message,
      validate: (v) =>
        ethers.isAddress(v.trim()) || 'Enter a valid 0x 📫',
      transformer: (v, { isFinal }) =>
        isFinal && ethers.isAddress(v.trim())
          ? maskAddress(ethers.getAddress(v.trim()))
          : v,
    });
    return ethers.getAddress(raw.trim());
  } catch {
    return null;
  }
}

export async function inputAmountNative(message: string): Promise<string | null> {
  try {
    return await input({
      message,
      validate: (v) => {
        try {
          ethers.parseEther(v.trim());
          return true;
        } catch {
          return 'Use a decimal amount, e.g. 0.01';
        }
      },
    });
  } catch {
    return null;
  }
}

export async function inputAmountToken(
  message: string,
  decimals: number,
): Promise<string | null> {
  try {
    return await input({
      message,
      validate: (v) => {
        try {
          ethers.parseUnits(v.trim(), decimals);
          return true;
        } catch {
          return 'Invalid amount for this 💵';
        }
      },
    });
  } catch {
    return null;
  }
}

export async function selectNetwork(options?: {
  customChoiceName?: string;
}): Promise<
  | { kind: 'preset'; index: number }
  | { kind: 'custom' }
  | null
> {
  const customLabel =
    options?.customChoiceName ?? 'Custom 🌐 + 💵 contract';
  try {
    const v = await select<string>({
      message: '🌐',
      pageSize: 12,
      choices: [
        ...CHAIN_PRESETS.map((p, i) => ({
          value: `preset:${i}`,
          name: `${p.name} (chain ${p.chainId})`,
        })),
        new Separator(),
        { value: 'custom', name: customLabel },
      ],
    });
    if (v === 'custom') return { kind: 'custom' };
    const m = /^preset:(\d+)$/.exec(v);
    if (!m) return null;
    return { kind: 'preset', index: Number(m[1]) };
  } catch {
    return null;
  }
}

export async function inputRpcOnly(): Promise<string | null> {
  try {
    const rpc = await input({
      message: '🌐 URL:',
      validate: (v) => v.trim().length > 0 || 'Required',
    });
    return rpc.trim();
  } catch {
    return null;
  }
}

export async function selectToken(symbols: TokenSymbol[]): Promise<TokenSymbol | null> {
  if (symbols.length === 0) return null;
  try {
    return await select<TokenSymbol>({
      message: '💵',
      choices: symbols.map((s) => ({ value: s, name: s })),
    });
  } catch {
    return null;
  }
}

export async function inputCustomRpcAndToken(): Promise<{
  rpc: string;
  token: string;
} | null> {
  try {
    const rpc = await input({
      message: '🌐 URL:',
      validate: (v) => v.trim().length > 0 || 'Required',
    });
    const token = await input({
      message: '💵 contract 📫:',
      validate: (v) =>
        ethers.isAddress(v.trim()) || 'Invalid contract address',
    });
    return { rpc: rpc.trim(), token: ethers.getAddress(token.trim()) };
  } catch {
    return null;
  }
}

export async function pressEnter(): Promise<void> {
  try {
    await input({ message: 'Press Enter to continue', default: '' });
  } catch {
    /* ignore */
  }
}
