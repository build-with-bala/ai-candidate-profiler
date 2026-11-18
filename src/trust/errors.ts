// The one error type of the trust layer. Callers branch on `code`; `message` never repeats the input.

export type TrustCode = "bad-base64" | "bad-format" | "not-json" | "not-canonical" | "too-large" | "bad-key" | "bad-signature" | "unknown-key"
  | "revoked-key" | "bad-invite" | "invite-other-company" | "invite-mismatch" | "outside-invite-window" | "fields-exceed-request"
  | "no-company-key" | "sealed-other-key" | "seal-failed" | "payload-malformed" | "timestamp-unsupported";

export class TrustError extends Error {
  readonly code: TrustCode;

  constructor(code: TrustCode, message: string) {
    super(message);
    this.name = "TrustError";
    this.code = code;
  }
}
