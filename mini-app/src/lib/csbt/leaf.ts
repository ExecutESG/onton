import { Address, beginCell, Cell } from "@ton/core";
import { sha256 } from "@ton/crypto";
import { CsbtLeafData } from "./types";

/**
 * Computes a deterministic 32-byte SHA-256 hash for arbitrary metadata objects.
 */
export async function hashMetadata(metadata: Record<string, any> | string): Promise<Buffer> {
  const content = typeof metadata === "string" ? metadata : JSON.stringify(metadata, Object.keys(metadata).sort());
  return Buffer.from(await sha256(Buffer.from(content, "utf-8")));
}

/**
 * Normalizes an arbitrary TON address string into a standard 33-byte Buffer (workchain + 32-byte hash).
 */
export function normalizeAddressBuffer(rawAddress: string): Buffer {
  const parsed = Address.parse(rawAddress);
  const buffer = Buffer.alloc(33);
  buffer.writeInt8(parsed.workChain, 0);
  parsed.hash.copy(buffer, 1);
  return buffer;
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
 * Off-chain leaf generator computing:
 * Leaf = SHA256(index + owner + event_uuid + metadata_hash)
 */
export async function generateLeafHash(leaf: CsbtLeafData): Promise<Buffer> {
  // 1. Index: 8-byte big-endian uint64
  const indexBuffer = Buffer.alloc(8);
  indexBuffer.writeBigUInt64BE(BigInt(leaf.index), 0);

  // 2. Owner: 33-byte normalized TON address
  const ownerBuffer = normalizeAddressBuffer(leaf.ownerAddress);

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

  // Concatenate: index + owner + event_uuid + metadata_hash
  const combined = Buffer.concat([indexBuffer, ownerBuffer, eventUuidBuffer, metaHashBuffer]);

  return Buffer.from(await sha256(combined));
}

/**
 * Builds a TON Cell representation of a cSBT leaf.
 */
export async function createLeafCell(leaf: CsbtLeafData): Promise<Cell> {
  const parsedAddress = Address.parse(leaf.ownerAddress);
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

  return beginCell()
    .storeUint(leaf.index, 64)
    .storeAddress(parsedAddress)
    .storeBuffer(uuidToBuffer(leaf.eventUuid))
    .storeBuffer(metaHashBuffer)
    .endCell();
}
