export type TokenSymbol = 'USDT' | 'USDC';

export type ChainPreset = {
  name: string;
  rpcDefault: string;
  chainId: bigint;
  tokens: Partial<Record<TokenSymbol, string>>;
};

export const CHAIN_PRESETS: ChainPreset[] = [
  {
    name: 'Ethereum Mainnet',
    rpcDefault: 'https://eth.llamarpc.com',
    chainId: 1n,
    tokens: {
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    },
  },
  {
    name: 'BSC',
    rpcDefault: 'https://bsc-dataseed.binance.org',
    chainId: 56n,
    tokens: {
      USDT: '0x55d398326f99059fF775485246999027B3197955',
      USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    },
  },
  {
    name: 'Arbitrum One',
    rpcDefault: 'https://arb1.arbitrum.io/rpc',
    chainId: 42161n,
    tokens: {
      USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    },
  },
  {
    name: 'Polygon',
    rpcDefault: 'https://polygon-rpc.com',
    chainId: 137n,
    tokens: {
      USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    },
  },
  {
    name: 'Base',
    rpcDefault: 'https://mainnet.base.org',
    chainId: 8453n,
    tokens: {
      USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    },
  },
  {
    name: 'Sepolia (testnet)',
    rpcDefault: 'https://rpc.sepolia.org',
    chainId: 11155111n,
    tokens: {
      USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      USDT: '0xaA8E23Fb1079EA71e0a56F04a18ea3ea1BFEE611',
    },
  },
];
