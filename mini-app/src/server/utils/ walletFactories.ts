// walletFactories.ts
import {
  // V1
  WalletContractV1R1,
  WalletContractV1R2,
  WalletContractV1R3,
  // V2
  WalletContractV2R1,
  WalletContractV2R2,
  // V3
  WalletContractV3R1,
  WalletContractV3R2,
  // V4  (aliased to the standard R2 code in @ton/ton ≥14)
  WalletContractV4 as WalletContractV4R2,
  // High-load V2 (Telegram / TON Space ‘new wallet’)
  // WalletContractHighloadV2,
} from "@ton/ton";
import type { Address } from "@ton/core";

type WalletFactory = {
  name: string;
  create: (opts: { workchain: number; publicKey: Buffer }) => { address: Address };
};

export const WALLET_FACTORIES: WalletFactory[] = [
  { name: "v1-r1", create: WalletContractV1R1.create },
  { name: "v1-r2", create: WalletContractV1R2.create },
  { name: "v1-r3", create: WalletContractV1R3.create },
  { name: "v2-r1", create: WalletContractV2R1.create },
  { name: "v2-r2", create: WalletContractV2R2.create },
  { name: "v3-r1", create: WalletContractV3R1.create },
  { name: "v3-r2", create: WalletContractV3R2.create },
  { name: "v4-r2", create: WalletContractV4R2.create },
  // { name: "highload-v2", create: WalletContractHighloadV2.create },
];
