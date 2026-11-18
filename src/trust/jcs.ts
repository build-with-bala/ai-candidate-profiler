// F2: RFC 8785 JSON Canonicalization Scheme (JCS). A file A signs or seals is exactly the JCS bytes of its value,
// and parseCanonical accepts no other byte sequence for that value.
import { equalBytes, fromUtf8, utf8 } from "./bytes";
import { TrustError } from "./errors";

/**
 * Containers nest at most this deep. F2 allows a depth cap (pre-flight G3). This one keeps the recursive writer
 * far from any stack limit, so a file nested 100,000 deep fails as not-canonical instead of overflowing the
 * stack, and a cyclic value fails as bad-format. No file this app writes comes close to it.
 */
const MAX_DEPTH = 512;
/** F2's default limit for reading: 8 MiB. */
const MAX_BYTES = 8 * 1024 * 1024;

/** The RFC 8785 serialization of `value`. What JSON cannot carry exactly throws TrustError("bad-format"). */
export function jcs(value: unknown): string {
  return write(value, 0);
}

export function jcsBytes(value: unknown): Uint8Array {
  return utf8(jcs(value));
}

/**
 * Reads a canonical file: at most `maxBytes` (else too-large), with no BOM, strict UTF-8 and JSON (else not-json),
 * and byte for byte the JCS form of the value it parses to (else not-canonical). A value that jcs cannot write,
 * such as the Infinity that 1e309 parses to or nesting past the cap, is not canonical either.
 */
export function parseCanonical(bytes: Uint8Array, o: { maxBytes?: number } = {}): unknown {
  const maxBytes = o.maxBytes ?? MAX_BYTES;
  if (bytes.length > maxBytes) throw new TrustError("too-large", `larger than ${maxBytes} bytes`);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    throw new TrustError("not-canonical", "not canonical JSON: it starts with a byte order mark");
  }
  const text = fromUtf8(bytes);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new TrustError("not-json", "not JSON");
  }
  let canonical: Uint8Array;
  try {
    canonical = jcsBytes(value);
  } catch {
    throw new TrustError("not-canonical", "not canonical JSON: the value has no RFC 8785 form");
  }
  if (!equalBytes(canonical, bytes)) {
    throw new TrustError("not-canonical", "not canonical JSON: the bytes differ from the value's RFC 8785 form");
  }
  return value;
}

/** `depth` counts the containers around `v`. */
function write(v: unknown, depth: number): string {
  switch (typeof v) {
    case "boolean":
      return v ? "true" : "false";
    case "number":
      if (!Number.isFinite(v)) throw new TrustError("bad-format", "JCS has no form for NaN or Infinity");
      return String(v); // Number#toString is RFC 8785's number form, and it writes -0 as 0
    case "string":
      return quote(v);
    case "object":
      if (v === null) return "null";
      if (depth >= MAX_DEPTH) throw new TrustError("bad-format", `JCS: nested deeper than ${MAX_DEPTH} levels`);
      return Array.isArray(v) ? writeArray(v, depth + 1) : writeObject(v, depth + 1);
    default:
      throw new TrustError("bad-format", `JCS has no form for a ${typeof v}`);
  }
}

function writeArray(items: readonly unknown[], depth: number): string {
  const out: string[] = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i] === undefined) throw new TrustError("bad-format", "JCS has no form for an undefined array item");
    out.push(write(items[i], depth));
  }
  return "[" + out.join(",") + "]";
}

/** Plain objects only (prototype Object.prototype or null); own string keys sorted by UTF-16 code units, undefined values left out. */
function writeObject(o: object, depth: number): string {
  const proto = Object.getPrototypeOf(o);
  if (proto !== Object.prototype && proto !== null) throw new TrustError("bad-format", "JCS writes only plain objects and arrays");
  const record = o as Record<string, unknown>;
  const out: string[] = [];
  for (const key of Object.keys(record).sort()) {
    const item = record[key];
    if (item !== undefined) out.push(quote(key) + ":" + write(item, depth));
  }
  return "{" + out.join(",") + "}";
}

/** JSON.stringify escapes exactly what RFC 8785 requires; a lone surrogate has no UTF-8 form, so it is refused first. */
function quote(s: string): string {
  if (!s.isWellFormed()) throw new TrustError("bad-format", "JCS has no form for a string with a lone surrogate");
  return JSON.stringify(s);
}
