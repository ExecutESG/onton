/**
 * Official TON TEP-85 (Soulbound Token) Opcodes
 * @see https://github.com/ton-blockchain/TEPs/blob/master/text/0085-soulbound-tokens.md
 */
export const SbtOpcodes = {
  // Standard NFT Collection & Item Opcodes
  mint: 0x00000001,
  batchMint: 0x00000002,
  changeOwner: 0x00000003,
  editContent: 0x00000004,
  getRoyaltyParams: 0x693d3950,
  getRoyaltyParamsResponse: 0xa8cb00ad,
  getStaticData: 0x2fcb26a2,
  reportStaticData: 0x8b771735,
  excesses: 0xd53276db,

  // TEP-62 Transfer (SBTs throw error 413 on this opcode)
  transfer: 0x5fcc3d14,

  // TEP-85 SBT Specific Opcodes
  proveOwnership: 0x04ded148,
  ownershipProof: 0x0524c7ae,
  ownershipProofBounced: 0xc18e86d2,
  requestOwner: 0xd0c3bfea,
  ownerInfo: 0x0dd607e3,
  destroy: 0x1f04537a,
  revoke: 0x6f89f5e3,
  takeExcess: 0xd136d3b3,
} as const;

export type SbtOpcodeName = keyof typeof SbtOpcodes;
