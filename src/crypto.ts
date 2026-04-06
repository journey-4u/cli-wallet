import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGO_LEGACY = 'aes-256-cbc';
const ALGO = 'aes-256-gcm';

const SCRYPT = { N: 65536, r: 8, p: 1, maxmem: 128 * 1024 * 1024 } as const;

type PayloadV2 = {
  v: 2;
  salt: string;
  iv: string;
  tag: string;
  data: string;
};

type PayloadLegacy = {
  iv: string;
  salt: string;
  data: string;
  v?: undefined;
};

function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, 32, SCRYPT);
}

export function encryptWithPassword(plain: string, password: string): string {
  const salt = randomBytes(16);
  const key = deriveKey(password, salt);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload: PayloadV2 = {
    v: 2,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted.toString('hex'),
  };
  return JSON.stringify(payload);
}

function decryptToBuffer(payloadJson: string, password: string): Buffer {
  const parsed = JSON.parse(payloadJson) as PayloadV2 | PayloadLegacy;

  if (parsed && typeof parsed === 'object' && 'v' in parsed && parsed.v === 2 && 'tag' in parsed) {
    const p = parsed as PayloadV2;
    const salt = Buffer.from(p.salt, 'hex');
    const key = deriveKey(password, salt);
    const iv = Buffer.from(p.iv, 'hex');
    const tag = Buffer.from(p.tag, 'hex');
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(p.data, 'hex')),
      decipher.final(),
    ]);
    key.fill(0);
    return decrypted;
  }

  const p = parsed as PayloadLegacy;
  const key = scryptSync(password, Buffer.from(p.salt, 'hex'), 32);
  const decipher = createDecipheriv(ALGO_LEGACY, key, Buffer.from(p.iv, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(p.data, 'hex')),
    decipher.final(),
  ]);
  key.fill(0);
  return decrypted;
}

export function decryptWithPassword(payloadJson: string, password: string): string {
  const decrypted = decryptToBuffer(payloadJson, password);
  try {
    return decrypted.toString('utf8');
  } finally {
    decrypted.fill(0);
  }
}
