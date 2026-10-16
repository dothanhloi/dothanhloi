import * as Crypto from 'expo-crypto';

const SALT = 'cancaphe::pin::v1';

/** Băm PIN bằng SHA-256 (không lưu PIN dạng chữ thường) */
export async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, SALT + String(pin).trim());
}
