/**
 * Converts a human-readable token amount into its smallest unit using the token decimals.
 * Handles floating-point rounding before casting to bigint to avoid precision issues.
 */
export const toTokenUnits = (amount: number, decimals: number): bigint => {
  const factor = 10 ** Math.max(decimals, 0);
  return BigInt(Math.round(amount * factor));
};
