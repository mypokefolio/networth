import { describe, expect, it } from "vitest";
import { isIOS, VAULT_ACCEPT, vaultAccept } from "./filePicker";
import type { PickerEnv } from "./filePicker";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";
const IPADOS =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";

const env = (over: Partial<PickerEnv>): PickerEnv => ({
  userAgent: MAC,
  maxTouchPoints: 0,
  finePointer: true,
  ...over,
});

describe("vaultAccept", () => {
  it("sends no filter on iPhone, so .nwvault is never greyed out", () => {
    expect(vaultAccept(env({ userAgent: IPHONE, maxTouchPoints: 5, finePointer: false }))).toBeUndefined();
  });

  it("detects iPadOS behind its desktop user agent", () => {
    const ipad = env({ userAgent: IPADOS, maxTouchPoints: 5, finePointer: false });
    expect(isIOS(ipad)).toBe(true);
    expect(vaultAccept(ipad)).toBeUndefined();
  });

  it("does not mistake a real Mac for an iPad", () => {
    expect(isIOS(env({ userAgent: IPADOS, maxTouchPoints: 0 }))).toBe(false);
  });

  it("sends no filter on Android", () => {
    expect(vaultAccept(env({ userAgent: ANDROID, maxTouchPoints: 5, finePointer: false }))).toBeUndefined();
  });

  it("sends no filter on a touch-screen laptop", () => {
    expect(vaultAccept(env({ maxTouchPoints: 10 }))).toBeUndefined();
  });

  it("filters only on a confident desktop", () => {
    expect(vaultAccept(env({}))).toBe(VAULT_ACCEPT);
  });
});
