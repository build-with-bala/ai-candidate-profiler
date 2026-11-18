import pkg from "../package.json" with { type: "json" };

export const VERSION: string = pkg.version;
export const CORE_PIN: { repo: string; sha: string; ref: string } = pkg.corePin;
