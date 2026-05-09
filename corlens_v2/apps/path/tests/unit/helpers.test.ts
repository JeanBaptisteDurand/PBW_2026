import { describe, expect, it } from "vitest";
import { decodeCurrency, hexToAscii, xrpDropsToString } from "../../src/domain/helpers.js";

describe("helpers", () => {
  it("hexToAscii decodes valid hex", () => {
    expect(hexToAscii("48656C6C6F")).toBe("Hello");
  });
  it("hexToAscii returns input for non-hex", () => {
    expect(hexToAscii("not-hex")).toBe("not-hex");
  });
  it("decodeCurrency passes 3-char codes through", () => {
    expect(decodeCurrency("USD")).toBe("USD");
  });
  it("decodeCurrency decodes 40-char hex", () => {
    expect(decodeCurrency("524C555344000000000000000000000000000000")).toBe("RLUSD");
  });
  it("xrpDropsToString converts drops to xrp", () => {
    expect(xrpDropsToString("1000000")).toBe("1");
    expect(xrpDropsToString(2_500_000)).toBe("2.5");
  });
});
