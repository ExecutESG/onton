import crypto from "crypto";
import { readRequiredSecret } from "@/server/utils/requiredSecrets";

export const DEFAULT_STEP_SECONDS = 20;
export const DEFAULT_WINDOW_TOLERANCE = 1; // ±1 step (20s before, current 20s, 20s after) = up to 60s window

/** TOTP_SECRET only. No JWT_SECRET or hardcoded salt fallback (#1052): a known salt lets anyone forge passes. */
const getSecret = (): string => readRequiredSecret("TOTP_SECRET");

export interface GeneratePassTokenResult {
  token: string;
  uuid: string;
  epochStep: number;
  expiresAt: number; // Unix ms
  remainingSeconds: number;
  stepSeconds: number;
}

export interface VerifyPassTokenResult {
  valid: boolean;
  uuid?: string;
  error?: "EXPIRED_TOKEN" | "INVALID_SIGNATURE" | "MALFORMED_TOKEN";
  message?: string;
  isDynamic: boolean;
  epochStep?: number;
}

/**
 * Generates an HMAC-SHA256 dynamic rotating pass token.
 * Format: ONTON:v1:<uuid>:<epochStep>:<signature>
 */
export function generatePassToken(
  uuid: string,
  options?: { stepSeconds?: number; timestamp?: number; secret?: string }
): GeneratePassTokenResult {
  const stepSeconds = options?.stepSeconds || DEFAULT_STEP_SECONDS;
  const nowMs = options?.timestamp !== undefined ? options.timestamp : Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  const epochStep = Math.floor(nowSec / stepSeconds);

  const secret = options?.secret || getSecret();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${uuid}:${epochStep}`)
    .digest("hex")
    .slice(0, 16);

  const expiresAtSec = (epochStep + 1) * stepSeconds;
  const expiresAt = expiresAtSec * 1000;
  const remainingSeconds = Math.max(0, expiresAtSec - nowSec);

  return {
    token: `ONTON:v1:${uuid}:${epochStep}:${signature}`,
    uuid,
    epochStep,
    expiresAt,
    remainingSeconds,
    stepSeconds,
  };
}

/**
 * Checks if raw QR input is formatted as an ONTON dynamic pass token.
 */
export function isDynamicToken(rawInput: string): boolean {
  return typeof rawInput === "string" && rawInput.startsWith("ONTON:v1:");
}

/**
 * Verifies a dynamic rotating pass token (ONTON:v1:...).
 * Raw UUIDs are rejected: they never expire, so a screenshot would work forever.
 * Supports clock skew tolerance and rejects expired screenshots.
 */
export function verifyPassToken(
  rawInput: string,
  options?: {
    stepSeconds?: number;
    windowTolerance?: number;
    currentTimestamp?: number;
    secret?: string;
  }
): VerifyPassTokenResult {
  if (!rawInput || typeof rawInput !== "string") {
    return {
      valid: false,
      error: "MALFORMED_TOKEN",
      message: "Empty or invalid pass data",
      isDynamic: false,
    };
  }

  const trimmed = rawInput.trim();

  if (!isDynamicToken(trimmed)) {
    return {
      valid: false,
      error: "MALFORMED_TOKEN",
      message: "Static pass codes are no longer accepted. Ask the attendee to open their live ticket QR.",
      isDynamic: false,
    };
  }

  const parts = trimmed.split(":");
  if (parts.length !== 5 || parts[0] !== "ONTON" || parts[1] !== "v1") {
    return {
      valid: false,
      error: "MALFORMED_TOKEN",
      message: "Malformed ONTON dynamic pass format",
      isDynamic: true,
    };
  }

  const [, , uuid, epochStepStr, signature] = parts;
  const epochStep = parseInt(epochStepStr, 10);
  if (isNaN(epochStep)) {
    return {
      valid: false,
      error: "MALFORMED_TOKEN",
      message: "Invalid epoch step in pass token",
      isDynamic: true,
    };
  }

  const stepSeconds = options?.stepSeconds || DEFAULT_STEP_SECONDS;
  const windowTolerance = options?.windowTolerance !== undefined ? options.windowTolerance : DEFAULT_WINDOW_TOLERANCE;
  const nowMs = options?.currentTimestamp !== undefined ? options.currentTimestamp : Date.now();
  const currentStep = Math.floor(nowMs / 1000 / stepSeconds);

  // Expiry / freshness check
  const stepDiff = Math.abs(currentStep - epochStep);
  if (stepDiff > windowTolerance) {
    return {
      valid: false,
      uuid,
      epochStep,
      error: "EXPIRED_TOKEN",
      message: "Pass QR code has expired. Please refresh your ticket.",
      isDynamic: true,
    };
  }

  // Cryptographic signature check across allowable windows
  const secret = options?.secret || getSecret();
  let matched = false;

  // Verify against the token's stated epochStep
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(`${uuid}:${epochStep}`)
    .digest("hex")
    .slice(0, 16);

  const isWellFormedSignature = /^[0-9a-f]{16}$/.test(signature);
  if (
    isWellFormedSignature &&
    crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSig, "hex"))
  ) {
    matched = true;
  }

  if (!matched) {
    return {
      valid: false,
      uuid,
      epochStep,
      error: "INVALID_SIGNATURE",
      message: "Invalid pass signature or forged QR code",
      isDynamic: true,
    };
  }

  return {
    valid: true,
    uuid,
    epochStep,
    isDynamic: true,
  };
}
