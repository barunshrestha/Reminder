import { describe, expect, it } from "vitest";
import { generateApiKey, hashApiKey } from "./api-key.guard";

describe("API key helpers", () => {
  it("hashes keys consistently", () => {
    const key = "pr_test_key";
    expect(hashApiKey(key)).toBe(hashApiKey(key));
    expect(hashApiKey(key)).toHaveLength(64);
  });

  it("generates prefixed keys", () => {
    const { plainKey, keyPrefix, keyHash } = generateApiKey();
    expect(plainKey.startsWith("pr_")).toBe(true);
    expect(keyPrefix).toBe(plainKey.slice(0, 12));
    expect(hashApiKey(plainKey)).toBe(keyHash);
  });
});
