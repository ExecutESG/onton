import { beginCell, Cell } from "@ton/core";
import { CsbtLeafData, CsbtProof, CsbtProofStep } from "./types";
import { generateLeafHash } from "./leaf";

/**
 * Computes parent node hash from left and right sibling nodes using TON cell representation hash.
 */
export function hashNodePair(left: Buffer, right: Buffer): Buffer {
  return beginCell().storeBuffer(left).storeBuffer(right).endCell().hash();
}

/**
 * Packs Merkle proof steps into a TON Cell chain compatible with csbt_anchor.fc.
 * Up to 3 proof steps (3 * 257 = 771 bits) fit per cell; additional steps chain via storeRef.
 */
export function serializeProofToCell(steps: CsbtProofStep[]): Cell {
  if (steps.length === 0) {
    return beginCell().endCell();
  }

  const chunks: CsbtProofStep[][] = [];
  for (let i = 0; i < steps.length; i += 3) {
    chunks.push(steps.slice(i, i + 3));
  }

  let tail: Cell | null = null;
  for (let i = chunks.length - 1; i >= 0; i--) {
    const builder = beginCell();
    for (const step of chunks[i]) {
      builder.storeUint(step.direction, 1);
      builder.storeBuffer(step.sibling);
    }
    if (tail) {
      builder.storeRef(tail);
    }
    tail = builder.endCell();
  }

  return tail || beginCell().endCell();
}

/**
 * Unpacks proof steps from a TON Cell chain.
 */
export function deserializeProofCell(proofCell: Cell): CsbtProofStep[] {
  const steps: CsbtProofStep[] = [];
  let cs = proofCell.beginParse();

  while (cs.remainingBits >= 257) {
    const direction = cs.loadUint(1) as 0 | 1;
    const sibling = cs.loadBuffer(32);
    steps.push({
      direction,
      sibling,
      siblingHex: sibling.toString("hex"),
    });

    if (cs.remainingBits < 257 && cs.remainingRefs > 0) {
      cs = cs.loadRef().beginParse();
    }
  }

  return steps;
}

export class CsbtMerkleTree {
  private leafHashes: Buffer[];
  private layers: Buffer[][];

  constructor(leafHashes: Buffer[]) {
    if (leafHashes.length === 0) {
      throw new Error("CsbtMerkleTree: Tree cannot be empty");
    }
    this.leafHashes = leafHashes;
    this.layers = this.buildTree(leafHashes);
  }

  /**
   * Factory method building a Merkle tree from raw CsbtLeafData records.
   */
  public static async fromLeaves(leaves: CsbtLeafData[]): Promise<CsbtMerkleTree> {
    const sortedLeaves = [...leaves].sort((a, b) => a.index - b.index);
    const hashes: Buffer[] = [];
    for (const leaf of sortedLeaves) {
      hashes.push(await generateLeafHash(leaf));
    }
    return new CsbtMerkleTree(hashes);
  }

  private buildTree(leaves: Buffer[]): Buffer[][] {
    const layers: Buffer[][] = [leaves];
    let currentLayer = leaves;

    while (currentLayer.length > 1) {
      const nextLayer: Buffer[] = [];
      for (let i = 0; i < currentLayer.length; i += 2) {
        const left = currentLayer[i];
        // If odd number of nodes, duplicate the last node to balance the branch
        const right = i + 1 < currentLayer.length ? currentLayer[i + 1] : left;
        nextLayer.push(hashNodePair(left, right));
      }
      layers.push(nextLayer);
      currentLayer = nextLayer;
    }

    return layers;
  }

  /**
   * Returns the 32-byte Merkle root buffer.
   */
  public getRoot(): Buffer {
    return this.layers[this.layers.length - 1][0];
  }

  /**
   * Returns the Merkle root as a lowercase hex string.
   */
  public getRootHex(): string {
    return this.getRoot().toString("hex");
  }

  /**
   * Returns the Merkle root as a 256-bit BigInt (for TON contract interactions).
   */
  public getRootBigInt(): bigint {
    return BigInt("0x" + this.getRootHex());
  }

  /**
   * Returns the total number of leaves in the tree.
   */
  public get leafCount(): number {
    return this.leafHashes.length;
  }

  /**
   * Returns the depth of the tree.
   */
  public get depth(): number {
    return this.layers.length - 1;
  }

  /**
   * Generates a directional Merkle inclusion proof for a given leaf index.
   */
  public getProof(leafIndex: number): CsbtProof {
    if (leafIndex < 0 || leafIndex >= this.leafHashes.length) {
      throw new Error(`CsbtMerkleTree: Leaf index ${leafIndex} out of bounds (0..${this.leafHashes.length - 1})`);
    }

    const steps: CsbtProofStep[] = [];
    let currentIndex = leafIndex;

    for (let layerIndex = 0; layerIndex < this.layers.length - 1; layerIndex++) {
      const layer = this.layers[layerIndex];
      const isRightChild = currentIndex % 2 === 1;
      const siblingIndex = isRightChild ? currentIndex - 1 : currentIndex + 1;

      let sibling: Buffer;
      if (siblingIndex < layer.length) {
        sibling = layer[siblingIndex];
      } else {
        // Handled duplicated/odd leaf edge
        sibling = layer[currentIndex];
      }

      steps.push({
        direction: isRightChild ? 1 : 0, // 1 = sibling on left, 0 = sibling on right
        sibling,
        siblingHex: sibling.toString("hex"),
      });

      currentIndex = Math.floor(currentIndex / 2);
    }

    const leafHash = this.leafHashes[leafIndex];
    const root = this.getRoot();

    return {
      leafIndex,
      leafHash,
      leafHashHex: leafHash.toString("hex"),
      root,
      rootHex: root.toString("hex"),
      steps,
    };
  }

  /**
   * Cryptographically verifies a Merkle inclusion proof against a root.
   */
  public static verifyProof(leafHash: Buffer, proof: CsbtProof, expectedRoot: Buffer): boolean {
    let currentHash = leafHash;

    for (const step of proof.steps) {
      if (step.direction === 0) {
        // Current is left, sibling is right
        currentHash = hashNodePair(currentHash, step.sibling);
      } else {
        // Sibling is left, current is right
        currentHash = hashNodePair(step.sibling, currentHash);
      }
    }

    return currentHash.equals(expectedRoot);
  }

  /**
   * Serializes the proof steps into a TON Cell for on-chain contract submission.
   */
  public static toProofCell(proof: CsbtProof): Cell {
    return serializeProofToCell(proof.steps);
  }
}
