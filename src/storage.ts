import fs from 'node:fs';

export type StoredWallet = {
  name: string;
  payload: string;
};

export type WalletFile = {
  wallets: StoredWallet[];
};

const EMPTY: WalletFile = { wallets: [] };

export function loadWalletFile(path: string): WalletFile {
  if (!fs.existsSync(path)) return structuredClone(EMPTY);
  const raw = fs.readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw) as WalletFile;
  if (!parsed.wallets || !Array.isArray(parsed.wallets)) return structuredClone(EMPTY);
  return parsed;
}

export function saveWalletFile(path: string, data: WalletFile): void {
  fs.writeFileSync(path, JSON.stringify(data, null, 0), 'utf8');
}

export function findWallet(data: WalletFile, name: string): StoredWallet | undefined {
  return data.wallets.find((w) => w.name === name);
}
