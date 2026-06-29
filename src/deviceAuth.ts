interface DeviceRecord {
  username: string;
  salt: string;
  iv: string;
  encrypted: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

function accountKey(username: string) {
  return `holy_click_device_${username.trim().toLocaleLowerCase()}`;
}

async function deriveKey(password: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 210_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function saveDeviceAccount(username: string, password: string, data: unknown) {
  const normalized = username.trim().toLocaleLowerCase();
  const existing = localStorage.getItem(accountKey(normalized));
  const salt = existing
    ? base64ToBytes((JSON.parse(existing) as DeviceRecord).salt)
    : crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(data)));
  const record: DeviceRecord = {
    username: normalized,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    encrypted: bytesToBase64(new Uint8Array(encrypted)),
  };
  localStorage.setItem(accountKey(normalized), JSON.stringify(record));
}

export async function loadDeviceAccount(username: string, password: string) {
  const normalized = username.trim().toLocaleLowerCase();
  const raw = localStorage.getItem(accountKey(normalized));
  if (!raw) throw new Error('Account not found on this device.');
  const record = JSON.parse(raw) as DeviceRecord;
  const key = await deriveKey(password, base64ToBytes(record.salt));
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(record.iv) },
      key,
      base64ToBytes(record.encrypted),
    );
    return JSON.parse(decoder.decode(decrypted)) as unknown;
  } catch {
    throw new Error('Incorrect password or damaged local account.');
  }
}

export function deviceAccountExists(username: string) {
  return Boolean(localStorage.getItem(accountKey(username)));
}
