import { ethers } from 'ethers';
import fs from 'fs';
import readlineSync from 'readline-sync';
import { createCipheriv, randomBytes, scryptSync, createDecipheriv } from 'crypto';

const WALLET_FILE = './wallet.json';

// Function to encrypt the private key using a password
function encryptPrivateKey(privateKey, password) {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 32);
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(privateKey, 'utf8'), cipher.final()]);
  return JSON.stringify({
    iv: iv.toString('hex'),
    salt: salt.toString('hex'),
    data: encrypted.toString('hex')
  });
}

// Function to decrypt the private key
function decryptPrivateKey(encryptedData, password) {
  const { iv, salt, data } = JSON.parse(encryptedData);
  const key = scryptSync(password, Buffer.from(salt, 'hex'), 32);
  const decipher = createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}

// Check if the wallet file exists
if (fs.existsSync(WALLET_FILE)) {
  console.log('Wallet found. Connecting...');

  const encryptedWallet = fs.readFileSync(WALLET_FILE, 'utf8');
  const password = readlineSync.question('Enter your password to unlock the wallet: ', {
    hideEchoBack: true
  });

  try {
    const privateKey = decryptPrivateKey(encryptedWallet, password);
    const wallet = new ethers.Wallet(privateKey);
    console.log('Wallet connected:', wallet.address);
  } catch (error) {
    console.error('Failed to decrypt wallet. Incorrect password or corrupted data.');
  }
} else {
  console.log('Wallet not found. Creating a new wallet...');

  const wallet = ethers.Wallet.createRandom();
  const password = readlineSync.question('Enter a password to encrypt your wallet: ', {
    hideEchoBack: true
  });

  const encryptedPrivateKey = encryptPrivateKey(wallet.privateKey, password);
  fs.writeFileSync(WALLET_FILE, encryptedPrivateKey);

  console.log('Wallet created and saved.');
  console.log('Wallet Address:', wallet.address);
}
