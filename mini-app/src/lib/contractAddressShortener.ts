/** Shortens a TON address to first 6 and last 4 characters */
export const contractAddressShortener = (address?: string): string => {
  if (!address || address.length <= 12) return address ?? "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};
