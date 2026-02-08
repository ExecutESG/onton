import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const removeKey = <T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> => {
  const { [key]: _, ...rest } = obj;
  return rest;
};

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const getObjectDifference = <T extends object>(obj1: T, obj2: T): Partial<T> | null => {
  const diff: Partial<T> = {};

  for (const key in obj1) {
    if (obj1.hasOwnProperty(key)) {
      if (obj1[key] !== obj2[key]) {
        diff[key] = obj2[key];
      }
    }
  }

  for (const key in obj2) {
    if (obj2.hasOwnProperty(key)) {
      if (obj1[key] === undefined && obj2[key] !== undefined) {
        diff[key] = obj2[key];
      }
    }
  }

  return Object.keys(diff).length > 0 ? diff : null;
};

export const fileToBase64 = (file: Blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
  });

export const redirectTo = (path: string) => {
  window.location.replace(path);
  return false;
};

export const removeSecretKey = (changes: any) =>
  JSON.stringify(changes ? removeKey(changes, "secret_phrase") : null, null, 2);

export type InferArrayType<T> = T extends (infer U)[] ? U : never;

export const formatPadNumber = (num: number): string => num.toString().padStart(2, "0");

/**
 * Formats a wallet address to be displayed in a more readable format.
 * Example: "0x1234567890123456789012345678901234567890" → "0x1234...7890"
 * @param address - The wallet address to format.
 * @returns The formatted wallet address.
 */
export const formatWalletAddress = (address: string) => {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};
