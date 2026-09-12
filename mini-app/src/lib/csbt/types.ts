import { Address, Cell } from "@ton/core";

export interface CsbtLeafData {
  index: number;
  ownerAddress: string;
  eventUuid: string;
  metadataHash?: string | Buffer;
  metadata?: Record<string, any>;
}

export interface CsbtProofStep {
  /**
   * Direction of the sibling:
   * 0 (right): current node is on the left, sibling is on the right -> H(current, sibling)
   * 1 (left): current node is on the right, sibling is on the left -> H(sibling, current)
   */
  direction: 0 | 1;
  sibling: Buffer;
  siblingHex: string;
}

export interface CsbtProof {
  leafIndex: number;
  leafHash: Buffer;
  leafHashHex: string;
  root: Buffer;
  rootHex: string;
  steps: CsbtProofStep[];
}

export interface CsbtAnchorData {
  ownerAddress: string;
  merkleRoot: string;
  eventUuid: string;
  totalLeaves: number;
  metadataUri: string;
}

export interface CsbtVerificationResult {
  isValid: boolean;
  leafIndex: number;
  ownerAddress: string;
  eventUuid: string;
  computedRootHex: string;
  expectedRootHex: string;
}
