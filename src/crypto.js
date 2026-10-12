// Password-protected storage of the GitHub key, using the browser's built-in WebCrypto.
const enc = new TextEncoder(), dec = new TextDecoder()
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const ITER = 310000

async function keyFrom(password, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
export async function lock(secret, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFrom(password, salt), enc.encode(secret))
  return { v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), data: b64(data) }
}
export async function unlock(box, password) {
  try {
    const k = await keyFrom(password, unb64(box.salt))
    return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, k, unb64(box.data)))
  } catch { return null }
}
// UTF-8 safe base64 for the GitHub contents API
export const toB64 = (str) => { const bytes = enc.encode(str); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin) }
export const fromB64 = (s) => dec.decode(unb64(s.replace(/\s/g, '')))
