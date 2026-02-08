/// <reference lib="esnext.bigint" />

function pow10(decimals: number): bigint {
  let result = BigInt(1);
  const base = BigInt(10);
  for (let i = 0; i < decimals; i++) result *= base;
  return result;
}

export function amountToUnits(amount: number, decimals: number): bigint {
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Amount must be a positive finite number");
  const factor = pow10(decimals);
  const fixed = amount.toFixed(decimals);
  const [whole, fraction = ""] = fixed.split(".");
  const wholePart = BigInt(whole);
  const fractionPart = fraction ? BigInt(fraction) : BigInt(0);
  return wholePart * factor + fractionPart;
}

export function unitsToAmount(units: bigint, decimals: number): number {
  if (decimals === 0) return Number(units);
  const factor = Math.pow(10, decimals);
  return Number(units) / factor;
}
