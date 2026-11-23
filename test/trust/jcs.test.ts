// F2: RFC 8785 (JCS) canonical JSON, and the strict reader that accepts only those bytes.
import { describe, expect, test } from "bun:test";
import { Buffer } from "node:buffer";
import { fromUtf8, utf8 } from "../../src/trust/bytes";
import { jcs, jcsBytes, parseCanonical } from "../../src/trust/jcs";
import { codeOf } from "../kit/keys";

/** The double whose IEEE-754 bit pattern is these 16 hex digits. */
function fromBits(bits: string): number {
  const view = new DataView(new ArrayBuffer(8));
  view.setBigUint64(0, BigInt("0x" + bits));
  return view.getFloat64(0);
}

const concat = (...parts: Uint8Array[]): Uint8Array => new Uint8Array(Buffer.concat(parts));
const nested = (depth: number): string => "[".repeat(depth) + "]".repeat(depth);

/** RFC 8785 Appendix B: bit pattern → output, or "throws". */
const APPENDIX_B: ReadonlyArray<readonly [string, string]> = [
  ["0000000000000000", "0"],
  ["8000000000000000", "0"],
  ["0000000000000001", "5e-324"],
  ["8000000000000001", "-5e-324"],
  ["7fefffffffffffff", "1.7976931348623157e+308"],
  ["ffefffffffffffff", "-1.7976931348623157e+308"],
  ["4340000000000000", "9007199254740992"],
  ["c340000000000000", "-9007199254740992"],
  ["4430000000000000", "295147905179352830000"],
  ["7fffffffffffffff", "throws"],
  ["7ff0000000000000", "throws"],
  ["44b52d02c7e14af5", "9.999999999999997e+22"],
  ["44b52d02c7e14af6", "1e+23"],
  ["44b52d02c7e14af7", "1.0000000000000001e+23"],
  ["444b1ae4d6e2ef4e", "999999999999999700000"],
  ["444b1ae4d6e2ef4f", "999999999999999900000"],
  ["444b1ae4d6e2ef50", "1e+21"],
  ["3eb0c6f7a0b5ed8c", "9.999999999999997e-7"],
  ["3eb0c6f7a0b5ed8d", "0.000001"],
  ["41b3de4355555553", "333333333.3333332"],
  ["41b3de4355555554", "333333333.33333325"],
  ["41b3de4355555555", "333333333.3333333"],
  ["41b3de4355555556", "333333333.3333334"],
  ["41b3de4355555557", "333333333.33333343"],
  ["becbf647612f3696", "-0.0000033333333333333333"],
  ["43143ff3c1cb0959", "1424953923781206.2"],
];

describe("jcs (F2)", () => {
  test.each(APPENDIX_B)("RFC 8785 Appendix B: %s → %s", (bits, out) => {
    const n = fromBits(bits);
    if (out === "throws") expect(codeOf(() => jcs(n))).toBe("bad-format");
    else expect(jcs(n)).toBe(out);
  });

  test("RFC 8785 §3.2.2: the serialization example, as a string", () => {
    const input = String.raw`{"numbers":[333333333.33333329,1E30,4.50,2e-3,0.000000000000000000000000001],"string":"\u20ac$\u000F\u000aA'\u0042\u0022\u005c\\\"\/","literals":[null,true,false]}`;
    // The € goes in through a substitution: Bun's transpiler escapes non-ASCII characters in a template's raw text.
    expect(jcs(JSON.parse(input))).toBe(
      String.raw`{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"${"€"}$\u000f\nA'B\"\\\\\"/"}`,
    );
  });

  test("RFC 8785 §3.2.3: the sorting example, as UTF-8 hex", () => {
    const input = String.raw`{
      "\u20ac": "Euro Sign",
      "\r": "Carriage Return",
      "\ufb33": "Hebrew Letter Dalet With Dagesh",
      "1": "One",
      "\ud83d\ude00": "Emoji: Grinning Face",
      "\u0080": "Control",
      "\u00f6": "Latin Small Letter O With Diaeresis"
    }`;
    expect(Buffer.from(jcsBytes(JSON.parse(input))).toString("hex")).toBe(
      "7b225c72223a2243617272696167652052657475726e222c2231223a224f6e65222c22c280223a22436f6e74726f6c222c22c3b6223a224c6174696e20536d616c6c204c6574746572204f205769746820446961657265736973222c22e282ac223a224575726f205369676e222c22f09f9880223a22456d6f6a693a204772696e6e696e672046616365222c22efacb3223a22486562726577204c65747465722044616c6574205769746820446167657368227d",
    );
  });

  class Point {
    x = 1;
  }
  const THROWS: ReadonlyArray<readonly [string, unknown]> = [
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["a lone high surrogate", "a\ud800"],
    ["a lone low surrogate", "\udc00b"],
    ["a lone surrogate in a key", { "\ud800": 1 }],
    ["[undefined]", [undefined]],
    ["an array hole", [1, , 2]],
    ["new Date()", new Date()],
    ["new Map()", new Map()],
    ["1n", 1n],
    ["a class instance", new Point()],
    ["a function", () => 1],
    ["a symbol", Symbol("s")],
    ["undefined", undefined],
  ];
  test.each(THROWS)("throws bad-format on %s", (_, value) => {
    expect(codeOf(() => jcs(value))).toBe("bad-format");
  });

  test("leaves out keys whose value is undefined", () => {
    expect(jcs({ a: undefined, b: 1 })).toBe('{"b":1}');
  });

  test("serializes objects with a null prototype like plain ones", () => {
    expect(jcs(Object.assign(Object.create(null), { b: 1, a: [true, null] }))).toBe('{"a":[true,null],"b":1}');
  });

  test("caps nesting at 512 levels, so deep and cyclic values throw instead of overflowing the stack (pre-flight G3)", () => {
    expect(jcs(JSON.parse(nested(512)))).toBe(nested(512));
    expect(codeOf(() => jcs(JSON.parse(nested(513))))).toBe("bad-format");
    expect(codeOf(() => jcs(JSON.parse(nested(100_000))))).toBe("bad-format");
    const cycle: unknown[] = [];
    cycle.push(cycle);
    expect(codeOf(() => jcs(cycle))).toBe("bad-format");
  });
});

describe("parseCanonical (F2 reading)", () => {
  const value = { b: [1, "two", null, -0.5], a: { "€": true } };
  const canonical = jcsBytes(value);
  const MIB = 1024 * 1024;

  test("accepts exactly the JCS bytes and returns the value", () => {
    expect(fromUtf8(canonical)).toBe('{"a":{"€":true},"b":[1,"two",null,-0.5]}');
    expect(parseCanonical(canonical)).toEqual(value);
    expect(parseCanonical(utf8(nested(512)))).toEqual(JSON.parse(nested(512)));
  });

  const NOT_CANONICAL: ReadonlyArray<readonly [string, Uint8Array]> = [
    ["a BOM", concat(Uint8Array.of(0xef, 0xbb, 0xbf), canonical)],
    ["the canonical bytes plus \\n", concat(canonical, utf8("\n"))],
    ["re-indented JSON", utf8(JSON.stringify(JSON.parse(fromUtf8(canonical)), null, 2))],
    ["CRLF line ends", utf8(JSON.stringify(JSON.parse(fromUtf8(canonical)), null, 2).replaceAll("\n", "\r\n"))],
    ["unsorted keys", utf8('{"b":1,"a":2}')],
    ['{"a":1,"a":1}', utf8('{"a":1,"a":1}')],
    ["1.0", utf8("1.0")],
    ['"\\u0041" (a needless escape)', utf8(String.raw`"\u0041"`)],
    ["1e309", utf8("1e309")],
    ["an escaped lone surrogate", utf8(String.raw`"\ud800"`)],
    ["100,000 nested arrays inside an object", utf8('{"a":' + nested(100_000) + "}")],
    ["100,000 bare nested arrays", utf8(nested(100_000))],
    ["513 nested arrays", utf8(nested(513))],
  ];
  test.each(NOT_CANONICAL)("rejects %s with not-canonical, and no other throw", (_, bytes) => {
    expect(codeOf(() => parseCanonical(bytes))).toBe("not-canonical");
  });

  test("rejects invalid UTF-8 and non-JSON with not-json", () => {
    for (const bytes of [Uint8Array.of(0xc3, 0x28), new Uint8Array(0), utf8("{"), utf8("{'a':1}"), utf8("NaN")]) {
      expect(codeOf(() => parseCanonical(bytes))).toBe("not-json");
    }
  });

  test("rejects 8 MiB + 1 byte with too-large, even when canonical, and accepts exactly 8 MiB", () => {
    const string = (bytes: number) => utf8('"' + "a".repeat(bytes - 2) + '"');
    expect(codeOf(() => parseCanonical(string(8 * MIB + 1)))).toBe("too-large");
    expect(parseCanonical(string(8 * MIB))).toHaveLength(8 * MIB - 2);
  });

  test("maxBytes sets the limit", () => {
    expect(codeOf(() => parseCanonical(canonical, { maxBytes: canonical.length - 1 }))).toBe("too-large");
    expect(parseCanonical(canonical, { maxBytes: canonical.length })).toEqual(value);
  });

  test("keeps a __proto__ key as data, never as the prototype", () => {
    const parsed = parseCanonical(utf8('{"__proto__":{"polluted":true}}')) as object;
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
    expect(Object.keys(parsed)).toEqual(["__proto__"]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
