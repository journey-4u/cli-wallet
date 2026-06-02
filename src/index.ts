import { ethers, HDNodeWallet } from 'ethers';
import ora from 'ora';
import { CHAIN_PRESETS } from './chains.js';
import type { TokenSymbol } from './chains.js';
import { WALLET_DAT } from './constants.js';
import { decryptWithPassword, encryptWithPassword } from './crypto.js';
import { findWallet, loadWalletFile, saveWalletFile, type StoredWallet } from './storage.js';
import {
  askMnemonic,
  askNewWalletName,
  askPasswordLine,
  confirmDelete,
  inputAddress,
  inputAmountNative,
  inputAmountToken,
  inputCustomRpcAndToken,
  inputRpc,
  inputRpcOnly,
  pickWallet,
  pressEnter,
  promptMenu,
  selectNetwork,
  selectToken,
} from './prompts.js';
import { bad, banner, maskAddress, note, ok, warn } from './ui.js';
import { walletFromMnemonicStripped } from './wallet.js';

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address account) view returns (uint256)',
] as const;

const PASSWORD_TRIES = 5;

async function decryptPayloadWithRetries(
  entry: StoredWallet,
  passwordPrompt: string,
): Promise<string | null> {
  for (let attempt = 1; attempt <= PASSWORD_TRIES; attempt++) {
    const prompt =
      attempt === 1
        ? passwordPrompt
        : `${passwordPrompt} (${attempt}/${PASSWORD_TRIES})`;
    const password = await askPasswordLine(prompt);
    if (password == null) return null;
    try {
      return decryptWithPassword(entry.payload, password);
    } catch {
      if (attempt < PASSWORD_TRIES) {
        bad('Wrong password.');
      } else {
        bad('Wrong password. No more attempts.');
      }
    }
  }
  return null;
}

async function askPasswordPair(): Promise<string | null> {
  const p1 = await askPasswordLine('Password:');
  if (p1 == null) return null;
  if (!p1) {
    bad('Password cannot be empty.');
    return null;
  }
  const p2 = await askPasswordLine('Repeat password:');
  if (p2 == null) return null;
  if (p1 !== p2) {
    bad('Passwords do not match.');
    return null;
  }
  return p1;
}

async function withUnlockedWallet<T>(
  name: string,
  fn: (wallet: ethers.Wallet) => Promise<T>,
): Promise<T | null> {
  const data = loadWalletFile(WALLET_DAT);
  const entry = findWallet(data, name);
  if (!entry) {
    bad(`👛 "${name}" not found.`);
    return null;
  }
  const phraseMaybe = await decryptPayloadWithRetries(
    entry,
    `Password for "${name}":`,
  );
  if (phraseMaybe == null) return null;
  let phrase: string | undefined = phraseMaybe;
  let wallet: ethers.Wallet;
  try {
    wallet = walletFromMnemonicStripped(phrase);
  } catch {
    bad('Stored secret is not a valid 🌱.');
    phrase = undefined;
    return null;
  }
  phrase = undefined;
  return fn(wallet);
}

async function cmdCreate(name: string): Promise<void> {
  const data = loadWalletFile(WALLET_DAT);
  if (findWallet(data, name)) {
    bad(`👛 "${name}" already exists.`);
    return;
  }
  const w = ethers.Wallet.createRandom();
  const phrase = w.mnemonic?.phrase;
  if (!phrase) {
    bad('Failed to generate 🌱.');
    return;
  }
  const address = w.address;
  const password = await askPasswordPair();
  if (!password) return;
  const payload = encryptWithPassword(phrase, password);
  data.wallets.push({ name, payload });
  saveWalletFile(WALLET_DAT, data);
  ok('👛 saved.');
  note(`📫: ${maskAddress(address)}`);
}

async function cmdImport(name: string): Promise<void> {
  const data = loadWalletFile(WALLET_DAT);
  if (findWallet(data, name)) {
    bad(`👛 "${name}" already exists.`);
    return;
  }
  const phraseRaw = await askMnemonic();
  if (phraseRaw == null) return;
  let hd: HDNodeWallet;
  try {
    hd = HDNodeWallet.fromPhrase(phraseRaw.normalize('NFKD').trim());
  } catch {
    bad('Invalid 🌱.');
    return;
  }
  const password = await askPasswordPair();
  if (!password) return;
  const payload = encryptWithPassword(hd.mnemonic!.phrase, password);
  data.wallets.push({ name, payload });
  saveWalletFile(WALLET_DAT, data);
  ok('👛 imported.');
  note(`📫: ${maskAddress(hd.address)}`);
}

function cmdList(): void {
  const data = loadWalletFile(WALLET_DAT);
  if (data.wallets.length === 0) {
    note('No 👛 yet.');
    return;
  }
  note('Saved 👛:');
  data.wallets.forEach((w, i) => {
    console.log(`  ${i + 1}. ${w.name}`);
  });
}

async function cmdAddress(name: string): Promise<void> {
  await withUnlockedWallet(name, async (wallet) => {
    note(`📫 (${name}):`);
    console.log(`  ${wallet.address}`);
  });
}

async function cmdSeed(name: string): Promise<void> {
  const data = loadWalletFile(WALLET_DAT);
  const entry = findWallet(data, name);
  if (!entry) {
    bad(`👛 "${name}" not found.`);
    return;
  }
  const phraseMaybe = await decryptPayloadWithRetries(
    entry,
    `Password for "${name}":`,
  );
  if (phraseMaybe == null) return;
  let phrase: string | undefined = phraseMaybe;
  try {
    walletFromMnemonicStripped(phrase);
  } catch {
    bad('Stored secret is not a valid 🌱.');
    return;
  }
  warn('Anyone with this 🌱 controls the 👛.');
  console.log(`  ${phrase}`);
  phrase = undefined;
}

async function cmdDelete(name: string): Promise<void> {
  const data = loadWalletFile(WALLET_DAT);
  const entry = findWallet(data, name);
  if (!entry) {
    bad(`👛 "${name}" not found.`);
    return;
  }
  const sure = await confirmDelete(name);
  if (sure == null || !sure) return;
  if (
    (await decryptPayloadWithRetries(entry, 'Password (confirm delete):')) ==
    null
  ) {
    return;
  }
  data.wallets = data.wallets.filter((w) => w.name !== name);
  saveWalletFile(WALLET_DAT, data);
  ok(`Removed "${name}" from ${WALLET_DAT}.`);
}

async function cmdSend(name: string): Promise<void> {
  await withUnlockedWallet(name, async (wallet) => {
    const netSel = await selectNetwork({
      customChoiceName: 'Custom 🌐 only (any chain)',
    });
    if (netSel == null) return;

    let rpc: string;
    let expectedChainId: bigint | undefined;

    if (netSel.kind === 'custom') {
      const rpcIn = await inputRpcOnly();
      if (rpcIn == null) return;
      rpc = rpcIn;
    } else {
      const preset = CHAIN_PRESETS[netSel.index];
      if (!preset) {
        bad('Invalid 🌐 choice.');
        return;
      }
      expectedChainId = preset.chainId;
      const rpcDefault = process.env.CLI_WALLET_RPC ?? preset.rpcDefault;
      const rpcIn = await inputRpc(rpcDefault);
      if (rpcIn == null) return;
      rpc = rpcIn;
    }

    const provider = new ethers.JsonRpcProvider(rpc);
    if (expectedChainId !== undefined) {
      try {
        const net = await provider.getNetwork();
        if (net.chainId !== expectedChainId) {
          warn(`🌐 reports chain ${net.chainId}; preset expected ${expectedChainId}.`);
        }
      } catch {
        /* ignore */
      }
    }

    let natBal: bigint;
    try {
      natBal = await provider.getBalance(wallet.address);
    } catch {
      bad('Could not read 💰. Check the 🌐 URL.');
      return;
    }
    note(`From: ${maskAddress(wallet.address)}`);
    note(`🪙: ${ethers.formatEther(natBal)} (keep some for ⛽)`);

    const to = await inputAddress('Recipient 📫:');
    if (to == null) return;
    const amountStr = await inputAmountNative('Amount (🪙, e.g. 0.01):');
    if (amountStr == null) return;
    const value = ethers.parseEther(amountStr.trim());
    if (value > natBal) {
      bad('Amount exceeds 💰 (⛽ not included in this check).');
      return;
    }

    const signer = wallet.connect(provider);
    const spinner = ora('Sending 📝…').start();
    try {
      const tx = await signer.sendTransaction({ to, value });
      spinner.text = `Confirming ${tx.hash.slice(0, 12)}…`;
      await tx.wait();
      spinner.succeed('Confirmed.');
      note(`📝: ${tx.hash}`);
    } catch (e) {
      spinner.fail('📝 failed.');
      bad(e instanceof Error ? e.message : String(e));
    }
  });
}

async function cmdSendToken(name: string): Promise<void> {
  await withUnlockedWallet(name, async (wallet) => {
    const netSel = await selectNetwork();
    if (netSel == null) return;

    let rpc: string;
    let tokenAddress: string;
    let expectedChainId: bigint | undefined;

    if (netSel.kind === 'custom') {
      const custom = await inputCustomRpcAndToken();
      if (custom == null) return;
      rpc = custom.rpc;
      tokenAddress = custom.token;
    } else {
      const preset = CHAIN_PRESETS[netSel.index];
      if (!preset) {
        bad('Invalid 🌐 choice.');
        return;
      }
      expectedChainId = preset.chainId;
      const available = (['USDT', 'USDC'] as TokenSymbol[]).filter((sym) => preset.tokens[sym]);
      if (available.length === 0) {
        bad('No 💵 configured for this 🌐.');
        return;
      }
      const sym = await selectToken(available);
      if (sym == null) return;
      tokenAddress = ethers.getAddress(preset.tokens[sym]!);
      const rpcDefault = process.env.CLI_WALLET_RPC ?? preset.rpcDefault;
      const rpcIn = await inputRpc(rpcDefault);
      if (rpcIn == null) return;
      rpc = rpcIn;
    }

    const provider = new ethers.JsonRpcProvider(rpc);
    if (expectedChainId !== undefined) {
      try {
        const net = await provider.getNetwork();
        if (net.chainId !== expectedChainId) {
          warn(`🌐 reports chain ${net.chainId}; preset expected ${expectedChainId}.`);
        }
      } catch {
        /* ignore */
      }
    }

    const signer = wallet.connect(provider);
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    let decimals: number;
    try {
      const d = await contract.decimals();
      decimals = Number(d);
    } catch {
      bad('Could not read 💵. Wrong contract or 🌐?');
      return;
    }

    let natBal: bigint;
    let tokenBal: bigint;
    try {
      natBal = await provider.getBalance(wallet.address);
      tokenBal = await contract.balanceOf(wallet.address);
    } catch {
      bad('Could not read 💰.');
      return;
    }

    note(`From: ${maskAddress(wallet.address)}`);
    note(`🪙: ${ethers.formatEther(natBal)}`);
    note(`💵: ${(Number(ethers.formatUnits(tokenBal, decimals)) / 1000).toFixed(2)}`);

    const to = await inputAddress('Recipient 📫:');
    if (to == null) return;
    const amountStr = await inputAmountToken('Amount (💵 units):', decimals);
    if (amountStr == null) return;
    const value = ethers.parseUnits(amountStr.trim(), decimals);
    if (value > tokenBal) {
      bad('Amount exceeds 💵.');
      return;
    }
    if (natBal === 0n) {
      warn('🪙 is 0 — you may lack ⛽.');
    }

    const spinner = ora('Sending 💵 transfer…').start();
    try {
      const tx = await contract.transfer(to, value);
      spinner.text = `Confirming ${tx.hash.slice(0, 12)}…`;
      await tx.wait();
      spinner.succeed('Confirmed.');
      note(`📝: ${tx.hash}`);
    } catch (e) {
      spinner.fail('📝 failed.');
      bad(e instanceof Error ? e.message : String(e));
    }
  });
}

async function runMenu(): Promise<void> {
  banner();
  while (true) {
    const action = await promptMenu();
    if (action == null || action === 'exit') {
      note('Goodbye.');
      break;
    }

    switch (action) {
      case 'create': {
        const name = await askNewWalletName();
        if (name) await cmdCreate(name);
        break;
      }
      case 'import': {
        const name = await askNewWalletName();
        if (name) await cmdImport(name);
        break;
      }
      case 'list':
        cmdList();
        break;
      case 'address': {
        const name = await pickWallet('Which 👛?');
        if (name) await cmdAddress(name);
        break;
      }
      case 'seed': {
        const name = await pickWallet('Which 👛?');
        if (name) await cmdSeed(name);
        break;
      }
      case 'sendNative': {
        const name = await pickWallet('Send 🪙 — which 👛?');
        if (name) await cmdSend(name);
        break;
      }
      case 'sendToken': {
        const name = await pickWallet('Send 💵 — which 👛?');
        if (name) await cmdSendToken(name);
        break;
      }
      case 'delete': {
        const name = await pickWallet('Delete — which 👛?');
        if (name) await cmdDelete(name);
        break;
      }
      default:
        break;
    }
    await pressEnter();
  }
}

void runMenu();
