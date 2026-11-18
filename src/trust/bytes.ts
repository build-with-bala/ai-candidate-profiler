// F1: strict base64url (RFC 4648 §5, no padding), plus the UTF-8 and byte helpers the trust layer shares.
import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import { TrustError } from "./errors";

const BASE64URL = /^[A-Za-z0-9_-]*$/;
const encoder = new TextEncoder();
// ignoreBOM keeps a leading U+FEFF in the text instead of dropping it, so decoding never loses a byte.
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

export function b64u(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64url");
}

/**
 * Decodes `s` only when it is the one canonical encoding of its bytes (F1): the URL-safe alphabet, no padding,
 * no length of 4n+1, and unused bits of zero, which the re-encoding check enforces. Without that check, a changed
 * last character of a signature could decode to the same bytes. `bytes` is the required length.
 */
export function unb64u(s: string, o: { bytes?: number } = {}): Uint8Array {
  if (typeof s !== "string" || !BASE64URL.test(s)) {
    throw new TrustError("bad-base64", "not base64url: only A-Z, a-z, 0-9, - and _ are allowed, with no padding");
  }
  if (s.length % 4 === 1) throw new TrustError("bad-base64", "not base64url: no encoding has a length of 4n+1 characters");
  const bytes = new Uint8Array(Buffer.from(s, "base64url"));
  if (b64u(bytes) !== s) throw new TrustError("bad-base64", "not canonical base64url: the last character has unused bits set");
  if (o.bytes !== undefined && bytes.length !== o.bytes) {
    throw new TrustError("bad-base64", `expected ${o.bytes} bytes, got ${bytes.length}`);
  }
  return bytes;
}

export function utf8(s: string): Uint8Array {
  return encoder.encode(s);
}

/** Strict UTF-8 decoding: an invalid sequence is TrustError("not-json"), never a replacement character. */
export function fromUtf8(b: Uint8Array): string {
  try {
    return decoder.decode(b);
  } catch {
    throw new TrustError("not-json", "not valid UTF-8");
  }
}

export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}
