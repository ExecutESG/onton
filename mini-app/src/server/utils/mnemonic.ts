export function toWords(src: string | string[]): string[] {
  return Array.isArray(src) ? src : src.trim().split(/\s+/);
}
