import { ethers, HDNodeWallet } from 'ethers';

export function walletFromMnemonicStripped(phrase: string): ethers.Wallet {
  const hd = HDNodeWallet.fromPhrase(phrase.normalize('NFKD').trim());
  return new ethers.Wallet(hd.privateKey);
}
