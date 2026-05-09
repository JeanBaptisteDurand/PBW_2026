// Pure helper functions for XRPL data decoding.
// No I/O. Used by graph-builder.ts (and re-exported for consumers).

const RLUSD_HEX_UPPER = "524C555344000000000000000000000000000000";

export function hexToAscii(hex: string): string {
  if (!/^[0-9A-F]+$/i.test(hex)) return hex;
  let out = "";
  for (let i = 0; i < hex.length; i += 2) {
    const code = Number.parseInt(hex.slice(i, i + 2), 16);
    if (code === 0) continue;
    out += String.fromCharCode(code);
  }
  return out.replace(/\0/g, "").trim();
}

export function decodeCurrency(currency: string): string {
  if (!currency) return "";
  if (currency.length === 3) return currency;
  if (currency.length === 40) {
    if (currency.toUpperCase() === RLUSD_HEX_UPPER) return "RLUSD";
    const ascii = hexToAscii(currency);
    // If it decoded to printable ASCII, return that; otherwise return original hex
    if (/^[\x20-\x7E]+$/.test(ascii)) return ascii;
    return currency;
  }
  return currency;
}

export function xrpDropsToString(drops: string | number): string {
  const n = typeof drops === "string" ? Number(drops) : drops;
  if (!Number.isFinite(n)) return "0";
  return (n / 1_000_000).toFixed(6).replace(/\.?0+$/, "") || "0";
}
