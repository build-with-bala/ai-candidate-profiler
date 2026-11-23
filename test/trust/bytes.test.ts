// F1: strict base64url, and the UTF-8 and byte helpers the trust layer shares.
import { describe, expect, test } from "bun:test";
import { Buffer } from "node:buffer";
import { b64u, equalBytes, fromUtf8, unb64u, utf8 } from "../../src/trust/bytes";
import { codeOf, VEC } from "../kit/keys";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
/** The V7 signature: 64 bytes, so its last character carries 4 unused bits. */
const V7_SIG = "xboFqdBnign8mQMslWGpHAzzOZ3kdrv-CP5h2crNAb1Il0wYVBlfnUkt3LKvESQAd-dAVMy3rPrcGOcK_sgEDg";

describe("b64u and unb64u (F1)", () => {
  test("round-trip every length from 0 to 70 bytes, without padding", () => {
    for (let n = 0; n <= 70; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 151 + n * 7 + 255) & 0xff);
      const s = b64u(bytes);
      expect(s).toMatch(/^[A-Za-z0-9_-]*$/);
      expect(s).toHaveLength(Math.ceil((n * 4) / 3));
      expect(unb64u(s)).toEqual(bytes);
    }
  });

  test("use the URL-safe alphabet, and encode a view of a larger buffer", () => {
    expect(b64u(Uint8Array.of(0xfb, 0xff))).toBe("-_8");
    expect(b64u(Uint8Array.of(9, 0xfb, 0xff, 9).subarray(1, 3))).toBe("-_8");
    expect(unb64u("-_8")).toEqual(Uint8Array.of(0xfb, 0xff));
  });

  test("unb64u rejects padding, + and /, whitespace, a length of 4n+1 and a non-string", () => {
    const bad = ["AQ==", "AQI=", "+_8", "-/8", "AQ I", " AQI", "AQI\n", "A", "AQIDB", 42 as unknown as string];
    for (const s of bad) expect(codeOf(() => unb64u(s))).toBe("bad-base64");
  });

  test("unb64u rejects a last character that differs only in its unused bits (pre-flight G19)", () => {
    // A 64-byte signature leaves 4 unused bits in its last character, a 32-byte key 2.
    const cases: ReadonlyArray<readonly [string, number, number]> = [[V7_SIG, 64, 4], [b64u(VEC.t1.pub), 32, 2]];
    for (const [s, bytes, bits] of cases) {
      const original = unb64u(s, { bytes });
      const mask = (1 << bits) - 1;
      const last = ALPHABET.indexOf(s.slice(-1));
      expect(last & mask).toBe(0);
      for (let unused = 1; unused <= mask; unused++) {
        const variant = s.slice(0, -1) + ALPHABET[last | unused];
        const lenient: Uint8Array = new Uint8Array(Buffer.from(variant, "base64url"));
        expect(lenient).toEqual(original); // a lenient decoder reads the same bytes
        expect(codeOf(() => unb64u(variant))).toBe("bad-base64");
      }
    }
  });

  test("unb64u(s, { bytes }) requires exactly that many bytes", () => {
    const of = (n: number) => b64u(new Uint8Array(n).fill(7));
    expect(unb64u(of(32), { bytes: 32 })).toHaveLength(32);
    expect(codeOf(() => unb64u(of(31), { bytes: 32 }))).toBe("bad-base64");
    expect(codeOf(() => unb64u(of(33), { bytes: 32 }))).toBe("bad-base64");
  });
});

describe("utf8 and fromUtf8", () => {
  test("round-trip text, keeping a leading BOM", () => {
    for (const s of ["", "plain", "€ ö 😀", "\uFEFFkept"]) expect(fromUtf8(utf8(s))).toBe(s);
    expect(utf8("€")).toEqual(Uint8Array.of(0xe2, 0x82, 0xac));
  });

  test("fromUtf8 is fatal: invalid UTF-8 throws not-json", () => {
    expect(codeOf(() => fromUtf8(Uint8Array.of(0xc3, 0x28)))).toBe("not-json");
    expect(codeOf(() => fromUtf8(Uint8Array.of(0xc0, 0xaf)))).toBe("not-json"); // overlong "/"
    expect(codeOf(() => fromUtf8(Uint8Array.of(0xed, 0xa0, 0x80)))).toBe("not-json"); // an encoded surrogate
  });
});

describe("equalBytes", () => {
  test("compares length and content", () => {
    expect(equalBytes(new Uint8Array(0), new Uint8Array(0))).toBe(true);
    expect(equalBytes(Uint8Array.of(1, 2), Uint8Array.of(1, 2))).toBe(true);
    expect(equalBytes(Uint8Array.of(1, 2), Uint8Array.of(1, 3))).toBe(false);
    expect(equalBytes(Uint8Array.of(1, 2), Uint8Array.of(1, 2, 3))).toBe(false);
  });
});
