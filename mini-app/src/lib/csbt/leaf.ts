import { Address, beginCell, Cell } from "@ton/core";
import { sha256 } from "@ton/crypto";
import crypto from "crypto";
import { CsbtLeafData } from "./types";

/**
 * Computes a deterministic 32-byte SHA-256 hash for arbitrary metadata objects.
 */
export async function hashMetadata(metadata: Record<string, any> | string): Promise<Buffer> {
  const content = typeof metadata === "string" ? metadata : JSON.stringify(metadata, Object.keys(metadata).sort());
  return Buffer.from(await sha256(Buffer.from(content, "utf-8")));
}

/**
 * Computes the deterministic 32-byte SHA-256 hash for a wallet-less user identity:
 * SHA256("onton:user:" + userId)
 */
export function getWalletlessUserHash(userId: string | number): Buffer {
  const raw = String(userId).trim();
  const normalizedId = raw.startsWith("onton:user:") ? raw.slice("onton:user:".length) : raw;
  return crypto.createHash("sha256").update(`onton:user:${normalizedId}`, "utf-8").digest();
}

export interface OwnerInfo {
  isWallet: boolean;
  workchain?: number;
  parsedAddress?: Address;
  userHash?: Buffer;
  buffer: Buffer;
}

/**
 * Parses an owner identifier into its underlying owner representation:
 * - Wallet users: int8 workchain ‖ 32-byte hash (33 bytes)
 * - Wallet-less users: marker byte 0x7F ‖ SHA256("onton:user:" + userId) (33 bytes)
 */
export function parseOwner(ownerIdentifier: string): OwnerInfo {
  const trimmed = ownerIdentifier.trim();
  try {
    const parsed = Address.parse(trimmed);
    const buffer = Buffer.alloc(33);
    buffer.writeInt8(parsed.workChain, 0);
    parsed.hash.copy(buffer, 1);
    return {
      isWallet: true,
      workchain: parsed.workChain,
      parsedAddress: parsed,
      buffer,
    };
  } catch {
    const userHash = getWalletlessUserHash(trimmed);
    const buffer = Buffer.alloc(33);
    buffer.writeUInt8(0x7f, 0);
    userHash.copy(buffer, 1);
    return {
      isWallet: false,
      userHash,
      buffer,
    };
  }
}

/**
 * Normalizes an arbitrary owner address / user identifier into a standard 33-byte Buffer:
 * - Wallet users: int8 workchain (1 byte) ‖ 32-byte address hash = 33 bytes.
 * - Wallet-less users: marker byte 0x7F (1 byte) ‖ SHA256("onton:user:" + userId) (32 bytes) = 33 bytes.
 */
export function normalizeAddressBuffer(rawAddress: string): Buffer {
  return parseOwner(rawAddress).buffer;
}

/**
 * Parses a UUID string into a 16-byte Buffer.
 */
export function uuidToBuffer(uuid: string): Buffer {
  const clean = uuid.replace(/-/g, "");
  if (clean.length === 32) {
    return Buffer.from(clean, "hex");
  }
  // Fallback to utf-8 buffer if not a standard 36-char UUID
  return Buffer.from(uuid, "utf-8");
}

/**
 * Computes event hash for on-chain anchoring:
 * event_hash = SHA256(kind ‖ event_uuid bytes), where kind is "native" or "legacy".
 */
export function computeEventHash(kind: "native" | "legacy", eventUuid: string): Buffer {
  const kindBuf = Buffer.from(kind, "utf-8");
  const uuidBuf = uuidToBuffer(eventUuid);
  return crypto.createHash("sha256").update(Buffer.concat([kindBuf, uuidBuf])).digest();
}

export function computeEventHashBigInt(kind: "native" | "legacy", eventUuid: string): bigint {
  return BigInt("0x" + computeEventHash(kind, eventUuid).toString("hex"));
}

/**
 * Resolves the raw owner string from leaf input data.
 */
export function resolveOwnerString(leaf: CsbtLeafData): string {
  if (leaf.ownerAddress !== undefined && leaf.ownerAddress !== "") {
    return leaf.ownerAddress;
  }
  if (leaf.userId !== undefined) {
    return String(leaf.userId);
  }
  return "0";
}

/**
 * Off-chain leaf generator computing:
 * Leaf = SHA256(index + owner + event_uuid + metadata_hash)
 * - index: 8-byte big-endian uint64
 * - owner: 33-byte normalized buffer (wallet: workchain ‖ hash, wallet-less: 0x7F ‖ hash)
 * - event_uuid: 16-byte UUID buffer
 * - metadata_hash: 32-byte hash buffer
 */
export async function generateLeafHash(leaf: CsbtLeafData): Promise<Buffer> {
  // 1. Index: 8-byte big-endian uint64
  const indexBuffer = Buffer.alloc(8);
  indexBuffer.writeBigUInt64BE(BigInt(leaf.index), 0);

  // 2. Owner: 33-byte normalized Buffer
  const ownerString = resolveOwnerString(leaf);
  const ownerBuffer = normalizeAddressBuffer(ownerString);

  // 3. Event UUID: 16-byte buffer
  const eventUuidBuffer = uuidToBuffer(leaf.eventUuid);

  // 4. Metadata Hash: 32-byte buffer
  let metaHashBuffer: Buffer;
  if (leaf.metadataHash) {
    metaHashBuffer = Buffer.isBuffer(leaf.metadataHash)
      ? leaf.metadataHash
      : Buffer.from(leaf.metadataHash, "hex");
  } else if (leaf.metadata) {
    metaHashBuffer = await hashMetadata(leaf.metadata);
  } else {
    metaHashBuffer = Buffer.alloc(32, 0);
  }

  // Concatenate: index (8) + owner (33) + event_uuid (16) + metadata_hash (32) = 89 bytes
  const combined = Buffer.concat([indexBuffer, ownerBuffer, eventUuidBuffer, metaHashBuffer]);

  return Buffer.from(await sha256(combined));
}

/**
 * Builds a TON Cell representation of a cSBT leaf:
 * - index: uint64 (64 bits)
 * - owner_kind: uint1 (1 bit, 0 = wallet address, 1 = wallet-less user hash)
 * - owner: MsgAddressInt (if owner_kind=0) OR uint256 (if owner_kind=1, 256 bits)
 * - event_uuid: 16-byte buffer (128 bits)
 * - metadata_hash: 32-byte buffer (256 bits)
 */
export async function createLeafCell(leaf: CsbtLeafData): Promise<Cell> {
  const ownerString = resolveOwnerString(leaf);
  const ownerInfo = parseOwner(ownerString);

  let metaHashBuffer: Buffer;
  if (leaf.metadataHash) {
    metaHashBuffer = Buffer.isBuffer(leaf.metadataHash)
      ? leaf.metadataHash
      : Buffer.from(leaf.metadataHash, "hex");
  } else if (leaf.metadata) {
    metaHashBuffer = await hashMetadata(leaf.metadata);
  } else {
    metaHashBuffer = Buffer.alloc(32, 0);
  }

  const builder = beginCell().storeUint(leaf.index, 64);

  if (ownerInfo.isWallet && ownerInfo.parsedAddress) {
    // 1-bit owner kind: 0 = wallet address
    builder.storeUint(0, 1);
    builder.storeAddress(ownerInfo.parsedAddress);
  } else {
    // 1-bit owner kind: 1 = wallet-less user
    builder.storeUint(1, 1);
    builder.storeBuffer(ownerInfo.userHash!);
  }

  builder.storeBuffer(uuidToBuffer(leaf.eventUuid));
  builder.storeBuffer(metaHashBuffer);

  return builder.endCell();
}
