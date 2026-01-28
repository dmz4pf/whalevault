/**
 * AES-256-GCM encryption module for WhaleVault V3.
 *
 * Provides wallet-derived encryption for off-chain note storage.
 * All cryptography uses the Web Crypto API exclusively.
 *
 * Flow:
 * 1. User signs "WhaleVault-v1" message with wallet
 * 2. SHA-256(signature) becomes the AES-256-GCM key
 * 3. Notes are encrypted/decrypted with that key
 */

const ENCRYPTION_MESSAGE = "WhaleVault-v1";
const SIG_CACHE_KEY = "wv_enc_sig";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode.apply(null, Array.from(bytes)));
}

function fromBase64(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Signature session cache (survives page refresh, cleared on tab close)
// ---------------------------------------------------------------------------

function cacheKey(publicKey: string): string {
  return `${SIG_CACHE_KEY}_${publicKey}`;
}

export function getCachedSignature(publicKey: string): Uint8Array | null {
  try {
    const cached = sessionStorage.getItem(cacheKey(publicKey));
    if (!cached) return null;
    return fromBase64(cached);
  } catch {
    return null;
  }
}

function cacheSignature(sig: Uint8Array, publicKey: string): void {
  try {
    sessionStorage.setItem(cacheKey(publicKey), toBase64(sig));
  } catch { /* ignore */ }
}

export function clearCachedSignature(publicKey?: string): void {
  try {
    if (publicKey) {
      sessionStorage.removeItem(cacheKey(publicKey));
    } else {
      // Clear all cached signatures
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(SIG_CACHE_KEY)) {
          sessionStorage.removeItem(key);
        }
      }
    }
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sign the encryption derivation message with the wallet.
 * Message: "WhaleVault-v1"
 */
export async function signEncryptionMessage(
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  publicKey: string
): Promise<Uint8Array> {
  const cached = getCachedSignature(publicKey);
  if (cached) return cached;

  const message = new TextEncoder().encode(ENCRYPTION_MESSAGE);
  const sig = await signMessage(message);
  cacheSignature(sig, publicKey);
  return sig;
}

/**
 * Derive AES-256-GCM encryption key from wallet signature.
 * Key = SHA-256(signature) imported as CryptoKey.
 */
export async function deriveEncryptionKey(
  signature: Uint8Array
): Promise<CryptoKey> {
  const buf = signature.buffer.slice(
    signature.byteOffset,
    signature.byteOffset + signature.byteLength
  ) as ArrayBuffer;
  const hash = await crypto.subtle.digest("SHA-256", buf);

  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Hash wallet public key for Supabase lookup.
 * Returns SHA-256(publicKey) as hex string.
 */
export async function walletHash(publicKey: string): Promise<string> {
  const encoded = new TextEncoder().encode(publicKey);
  const buf = encoded.buffer.slice(
    encoded.byteOffset,
    encoded.byteOffset + encoded.byteLength
  ) as ArrayBuffer;
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return toHex(new Uint8Array(hash));
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns base64-encoded ciphertext and base64-encoded random nonce (IV).
 */
export async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<{ ciphertext: string; nonce: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const plainBuf = encoded.buffer.slice(
    encoded.byteOffset,
    encoded.byteOffset + encoded.byteLength
  ) as ArrayBuffer;

  const ivBuf = iv.buffer.slice(
    iv.byteOffset,
    iv.byteOffset + iv.byteLength
  ) as ArrayBuffer;

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: ivBuf },
    key,
    plainBuf
  );

  return {
    ciphertext: toBase64(new Uint8Array(encrypted)),
    nonce: toBase64(iv),
  };
}

/**
 * Decrypt AES-256-GCM ciphertext.
 * Returns plaintext string.
 */
export async function decrypt(
  ciphertext: string,
  nonce: string,
  key: CryptoKey
): Promise<string> {
  const iv = fromBase64(nonce);
  const data = fromBase64(ciphertext);

  const ivBuf = iv.buffer.slice(
    iv.byteOffset,
    iv.byteOffset + iv.byteLength
  ) as ArrayBuffer;
  const dataBuf = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  ) as ArrayBuffer;

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBuf },
    key,
    dataBuf
  );

  return new TextDecoder().decode(decrypted);
}
