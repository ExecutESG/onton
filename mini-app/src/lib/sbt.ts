import tonCenter, { v2_client } from "@/services/tonCenter";
import {
  Address,
  Cell,
  internal,
  beginCell,
  contractAddress,
  StateInit,
  SendMode,
  OpenedContract,
  toNano,
} from "@ton/core";
import { KeyPair, mnemonicToPrivateKey } from "@ton/crypto";
import { WalletContractV4 } from "@ton/ton";
import { logger } from "@/server/utils/logger";
import { config } from "@/server/config";
import { SbtOpcodes } from "@/lib/sbtOpcodes";
import * as dotenv from "dotenv";

dotenv.config();

export type OpenedWallet = {
  contract: OpenedContract<WalletContractV4>;
  keyPair: KeyPair;
};

export async function openWallet(mnemonic: string[]): Promise<OpenedWallet> {
  const keyPair = await mnemonicToPrivateKey(mnemonic);
  const client = v2_client();

  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keyPair.publicKey,
  });

  const contract = client.open(wallet);
  return { contract, keyPair };
}

function bufferToChunks(buff: Buffer, chunkSize: number): Buffer[] {
  const chunks: Buffer[] = [];
  while (buff.byteLength > 0) {
    chunks.push(buff.subarray(0, chunkSize));
    buff = buff.subarray(chunkSize);
  }
  return chunks;
}

export function makeSnakeCell(data: Buffer): Cell {
  const chunks = bufferToChunks(data, 127);

  if (chunks.length === 0) {
    return beginCell().endCell();
  }

  if (chunks.length === 1) {
    return beginCell().storeBuffer(chunks[0]).endCell();
  }

  let curCell = beginCell();

  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i];
    curCell.storeBuffer(chunk);

    if (i - 1 >= 0) {
      const nextCell = beginCell();
      nextCell.storeRef(curCell);
      curCell = nextCell;
    }
  }

  return curCell.endCell();
}

export function encodeOffChainContent(content: string): Cell {
  let data = Buffer.from(content);
  const offChainPrefix = Buffer.from([0x01]);
  data = Buffer.concat([offChainPrefix, data]);
  return makeSnakeCell(data);
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function waitSeqno(seqno: number, wallet: OpenedWallet): Promise<number> {
  let seqnoAfter = -1;
  for (let attempt = 0; attempt < 15; attempt++) {
    await sleep(2000);
    try {
      seqnoAfter = await wallet.contract.getSeqno();
      if (seqnoAfter > seqno) break;
    } catch {
      // transient RPC failure, continue polling
    }
  }
  return seqnoAfter;
}

// --------------------------------------------------------------------------
// Official Bytecodes (TEP-85 SBT Item + Standard Collection with SBT Item Code)
// --------------------------------------------------------------------------

/**
 * Standard NFT Collection FunC bytecode (TEP-62 compatible collection)
 */
export const SBT_COLLECTION_CODE_BOC =
  "te6cckECFAEAAh8AART/APSkE/S88sgLAQIBYgkCAgEgBAMAJbyC32omh9IGmf6mpqGC3oahgsQCASAIBQIBIAcGAC209H2omh9IGmf6mpqGAovgngCOAD4AsAAvtdr9qJofSBpn+pqahg2IOhph+mH/SAYQAEO4tdMe1E0PpA0z/U1NQwECRfBNDUMdQw0HHIywcBzxbMyYAgLNDwoCASAMCwA9Ra8ARwIfAFd4AYyMsFWM8WUAT6AhPLaxLMzMlx+wCAIBIA4NABs+QB0yMsCEsoHy//J0IAAtAHIyz/4KM8WyXAgyMsBE/QA9ADLAMmAE59EGOASK3wAOhpgYC42Eit8H0gGADpj+mf9qJofSBpn+pqahhBCDSenKgpQF1HFBuvgoDoQQhUZYBWuEAIZGWCqALnixJ9AQpltQnlj+WfgOeLZMAgfYBwGyi544L5cMiS4ADxgRLgAXGBEuAB8YEYGYHgAkExIREAA8jhXU1DAQNEEwyFAFzxYTyz/MzMzJ7VTgXwSED/LwACwyNAH6QDBBRMhQBc8WE8s/zMzMye1UAKY1cAPUMI43gED0lm+lII4pBqQggQD6vpPywY/egQGTIaBTJbvy9AL6ANQwIlRLMPAGI7qTAqQC3gSSbCHis+YwMlBEQxPIUAXPFhPLP8zMzMntVABgNQLTP1MTu/LhklMTugH6ANQwKBA0WfAGjhIBpENDyFAFzxYTyz/MzMzJ7VSSXwXiN0CayQ==";

/**
 * Official TEP-85 Soulbound Token Item bytecode (non-transferable, revocable)
 * Verified from ton-community/assets-sdk and getgems-io/nft-contracts sbt-item.fc
 */
export const SBT_ITEM_CODE_BOC =
  "te6ccgECEwEAAzsAART/APSkE/S88sgLAQIBYgIDAgLOBAUCASAPEAS9RsIiDHAJFb4AHQ0wP6QDDwAvhCs44cMfhDAccF8uGV+kAB+GTUAfhm+kAw+GVw+GfwA+AC0x8CcbDjAgHTP4IQ0MO/6lIwuuMCghAE3tFIUjC64wIwghAvyyaiUiC6gGBwgJAgEgDQ4AlDAx0x+CEAUkx64Suo450z8wgBD4RHCCEMGOhtJVA22AQAPIyx8Syz8hbrOTAc8XkTHiyXEFyMsFUATPFlj6AhPLaszJAfsAkTDiAMJsEvpA1NMAMPhH+EHIy/9QBs8W+ETPFhLMFMs/UjDLAAPDAJb4RlADzALegBB4sXCCEA3WB+NANRSAQAPIyx8Syz8hbrOTAc8XkTHiyXEFyMsFUATPFlj6AhPLaszJAfsAAMYy+ERQA8cF8uGR+kDU0wAw+Ef4QcjL//hEzxYTzBLLP1IQywABwwCU+EYBzN6AEHixcIIQBSTHrkBVA4BAA8jLHxLLPyFus5MBzxeRMeLJcQXIywVQBM8WWPoCE8tqzMkB+wAD+o5AMfhByMv/+EPPFoAQcIIQi3cXNUAVUEQDgEADyMsfEss/IW6zkwHPF5Ex4slxBcjLBVAEzxZY+gITy2rMyQH7AOCCEB8EU3pSILrjAoIQb4n141Iguo4WW/hFAccF8uGR+EfAAPLhk/gj+GfwA+CCENE207NSILrjAjAxCgsMAJIx+EQixwXy4ZGAEHCCENUydtsQJFUCbYMGA8jLHxLLPyFus5MBzxeRMeLJcQXIywVQBM8WWPoCE8tqzMkB+wCLAvhkiwL4ZfADAI4x+EQixwXy4ZGCCvrwgHD7AoAQcIIQ1TJ22xAkVQJtgwYDyMsfEss/IW6zkwHPF5Ex4slxBcjLBVAEzxZY+gITy2rMyQH7AAAgghBfzD0UupPywZ3ehA/y8ABhO1E0NM/Afhh+kAB+GNw+GIg10nCAI4Wf/hi+kAB+GTUAfhm+kAB+GXTPzD4Z5Ew4oAA3PhH+Eb4QcjLP/hDzxb4RM8WzPhFzxbLP8ntVIAIBWBESAB28fn+AF8IXwg/CH8InwjQADbVjHgBfCLAADbewfgBfCPA=";

// --------------------------------------------------------------------------
// Deterministic SBT Item Address Calculation
// --------------------------------------------------------------------------

export function calculateSbtItemStateInit(collectionAddress: Address, itemIndex: number): StateInit {
  const code = Cell.fromBase64(SBT_ITEM_CODE_BOC);
  const data = beginCell()
    .storeUint(itemIndex, 64)
    .storeAddress(collectionAddress)
    .endCell();
  return { code, data };
}

export function calculateSbtItemAddress(collectionAddress: Address | string, itemIndex: number): Address {
  const colAddr = typeof collectionAddress === "string" ? Address.parse(collectionAddress) : collectionAddress;
  const stateInit = calculateSbtItemStateInit(colAddr, itemIndex);
  return contractAddress(0, stateInit);
}

// --------------------------------------------------------------------------
// SBT Collection
// --------------------------------------------------------------------------

export type SbtCollectionData = {
  ownerAddress: Address;
  nextItemIndex: number;
  collectionContentUrl: string;
  commonContentUrl: string;
  royaltyPercent?: number;
  royaltyAddress?: Address;
};

export type SbtMintParams = {
  queryId?: number | null;
  itemOwnerAddress: Address;
  itemIndex: number;
  amount: bigint;
  commonContentUrl: string;
  authorityAddress: Address;
};

export class SbtCollection {
  private data: SbtCollectionData;

  constructor(data: SbtCollectionData) {
    this.data = data;
  }

  private createCodeCell(): Cell {
    return Cell.fromBase64(SBT_COLLECTION_CODE_BOC);
  }

  private createDataCell(): Cell {
    const data = this.data;
    const dataCell = beginCell();

    dataCell.storeAddress(data.ownerAddress);
    dataCell.storeUint(data.nextItemIndex, 64);

    const contentCell = beginCell();
    const collectionContent = encodeOffChainContent(data.collectionContentUrl);
    const commonContent = beginCell().storeBuffer(Buffer.from(data.commonContentUrl));

    contentCell.storeRef(collectionContent);
    contentCell.storeRef(commonContent.asCell());
    dataCell.storeRef(contentCell);

    // SBT Item Code Cell
    const sbtItemCodeCell = Cell.fromBase64(SBT_ITEM_CODE_BOC);
    dataCell.storeRef(sbtItemCodeCell);

    // Royalty params: for non-transferable SBTs, default to 0% royalty
    const royaltyBase = 1000;
    const royaltyFactor = Math.floor((data.royaltyPercent || 0) * royaltyBase);
    const royaltyAddress = data.royaltyAddress || data.ownerAddress;
    const royaltyCell = beginCell();
    royaltyCell.storeUint(royaltyFactor, 16);
    royaltyCell.storeUint(royaltyBase, 16);
    royaltyCell.storeAddress(royaltyAddress);
    dataCell.storeRef(royaltyCell);

    return dataCell.endCell();
  }

  public get stateInit(): StateInit {
    return {
      code: this.createCodeCell(),
      data: this.createDataCell(),
    };
  }

  public get address(): Address {
    return contractAddress(0, this.stateInit);
  }

  /**
   * Builds the internal message body for minting a TEP-85 SBT item via the collection
   */
  public createMintBody(params: SbtMintParams): Cell {
    const body = beginCell();
    body.storeUint(SbtOpcodes.mint, 32); // op::deploy_item = 1
    body.storeUint(params.queryId || 0, 64);
    body.storeUint(params.itemIndex, 64);
    body.storeCoins(params.amount);

    // TEP-85 SBT Item initialization message
    const sbtItemContent = beginCell();
    sbtItemContent.storeAddress(params.itemOwnerAddress);
    const offChainCell = encodeOffChainContent(params.commonContentUrl);
    sbtItemContent.storeRef(offChainCell);
    sbtItemContent.storeAddress(params.authorityAddress);

    body.storeRef(sbtItemContent.endCell());
    return body.endCell();
  }

  public async deploy(wallet: OpenedWallet, initialGas = "0.055"): Promise<number> {
    const seqno = await wallet.contract.getSeqno();

    await wallet.contract.sendTransfer({
      seqno,
      secretKey: wallet.keyPair.secretKey,
      messages: [
        internal({
          value: initialGas,
          to: this.address,
          init: this.stateInit,
        }),
      ],
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    });

    return seqno;
  }
}

// --------------------------------------------------------------------------
// SBT Item Interaction Wrapper (TEP-85 Messages)
// --------------------------------------------------------------------------

export class SbtItem {
  public static createDestroyBody(queryId = 0): Cell {
    return beginCell()
      .storeUint(SbtOpcodes.destroy, 32)
      .storeUint(queryId, 64)
      .endCell();
  }

  public static createRevokeBody(queryId = 0): Cell {
    return beginCell()
      .storeUint(SbtOpcodes.revoke, 32)
      .storeUint(queryId, 64)
      .endCell();
  }

  public static createProveOwnershipBody(params: {
    queryId?: number;
    to: Address;
    data: Cell;
    withContent: boolean;
  }): Cell {
    return beginCell()
      .storeUint(SbtOpcodes.proveOwnership, 32)
      .storeUint(params.queryId || 0, 64)
      .storeAddress(params.to)
      .storeRef(params.data)
      .storeBit(params.withContent)
      .endCell();
  }

  public static createRequestOwnerBody(params: {
    queryId?: number;
    dest: Address;
    forwardPayload: Cell;
    withContent: boolean;
  }): Cell {
    return beginCell()
      .storeUint(SbtOpcodes.requestOwner, 32)
      .storeUint(params.queryId || 0, 64)
      .storeAddress(params.dest)
      .storeRef(params.forwardPayload)
      .storeBit(params.withContent)
      .endCell();
  }
}

// --------------------------------------------------------------------------
// High-Level Wallet Operations
// --------------------------------------------------------------------------

export type SbtWalletOptions = string | { mnemonic?: string; expectedMinterAddress?: string };

function extractWalletOptions(options?: SbtWalletOptions): {
  mnemonic: string | undefined;
  expectedMinterAddress: string | undefined;
} {
  if (!options) {
    return { mnemonic: undefined, expectedMinterAddress: undefined };
  }

  if (typeof options === "string") {
    return { mnemonic: options, expectedMinterAddress: undefined };
  }

  return {
    mnemonic: options.mnemonic,
    expectedMinterAddress: options.expectedMinterAddress,
  };
}

function normalizeAddress(address: string): string | null {
  try {
    return Address.parse(address).toString({ bounceable: false });
  } catch (error) {
    logger.error("normalizeAddress: failed to parse address", { address, error });
    return null;
  }
}

/**
 * Deploys an on-chain TEP-85 SBT Collection contract.
 */
export async function deploySbtCollection(
  collectionMetadataUrl: string,
  authorityAddress?: string,
  options?: SbtWalletOptions
): Promise<string | null> {
  const { mnemonic, expectedMinterAddress } = extractWalletOptions(options);
  const mnemonicSource = mnemonic ?? process.env.MNEMONIC ?? "";
  const mnemonicWords = mnemonicSource.split(" ").filter(Boolean);
  if (mnemonicWords.length === 0) {
    logger.error("deploySbtCollection: MNEMONIC is not configured or empty");
    return null;
  }

  const wallet = await openWallet(mnemonicWords);

  const normalizedExpected =
    expectedMinterAddress !== undefined
      ? normalizeAddress(expectedMinterAddress)
      : mnemonic
        ? null
        : config?.ONTON_MINTER_WALLET
          ? normalizeAddress(config.ONTON_MINTER_WALLET)
          : null;
  const normalizedWalletAddress = wallet.contract.address.toString({ bounceable: false });

  if (normalizedExpected && normalizedWalletAddress !== normalizedExpected) {
    logger.error("deploySbtCollection: mnemonic address mismatch", {
      expected: normalizedExpected,
      derived: normalizedWalletAddress,
    });
    return null;
  }

  logger.log("deploySbtCollection: Starting deployment of TEP-85 SBT Collection...");

  const collectionData: SbtCollectionData = {
    ownerAddress: wallet.contract.address,
    nextItemIndex: 0,
    collectionContentUrl: collectionMetadataUrl,
    commonContentUrl: "",
    royaltyPercent: 0,
    royaltyAddress: wallet.contract.address,
  };

  const collection = new SbtCollection(collectionData);
  const seqno = await collection.deploy(wallet);
  logger.log(`deploySbtCollection: Collection deployed to address ${collection.address.toString()}`);
  await waitSeqno(seqno, wallet);
  await sleep(1500);

  return collection.address.toString();
}

/**
 * Mints an individual TEP-85 Soulbound Token to an attendee's wallet.
 */
export async function mintSBT(
  ownerAddress: string,
  collectionAddress: string,
  sbtIndex: number | null,
  sbtMetadataUrl: string,
  authorityAddress?: string,
  options?: SbtWalletOptions
): Promise<{ itemAddress: string; transactionHash?: string } | null> {
  const parsedCollectionAddress = Address.parse(collectionAddress);

  if (sbtIndex === null) {
    const result = await tonCenter.fetchCollection(collectionAddress);
    sbtIndex = Number(result?.nft_collections?.[0]?.next_item_index ?? 0);
  }

  // Precompute deterministic item address
  const deterministicItemAddress = calculateSbtItemAddress(parsedCollectionAddress, sbtIndex);
  logger.log(`mintSBT: Target item index ${sbtIndex}, address: ${deterministicItemAddress.toString()}`);

  const { mnemonic, expectedMinterAddress } = extractWalletOptions(options);
  const mnemonicSource = mnemonic ?? process.env.MNEMONIC ?? "";
  const mnemonicWords = mnemonicSource.split(" ").filter(Boolean);
  if (mnemonicWords.length === 0) {
    logger.error("mintSBT: MNEMONIC is not configured or empty");
    return null;
  }

  const wallet = await openWallet(mnemonicWords);

  const normalizedExpected =
    expectedMinterAddress !== undefined
      ? normalizeAddress(expectedMinterAddress)
      : mnemonic
        ? null
        : config?.ONTON_MINTER_WALLET
          ? normalizeAddress(config.ONTON_MINTER_WALLET)
          : null;
  const normalizedWalletAddress = wallet.contract.address.toString({ bounceable: false });

  if (normalizedExpected && normalizedWalletAddress !== normalizedExpected) {
    logger.error("mintSBT: mnemonic address mismatch", {
      expected: normalizedExpected,
      derived: normalizedWalletAddress,
    });
    return null;
  }

  const parsedAuthority = authorityAddress ? Address.parse(authorityAddress) : wallet.contract.address;

  const collectionData: SbtCollectionData = {
    ownerAddress: wallet.contract.address,
    nextItemIndex: sbtIndex,
    collectionContentUrl: "",
    commonContentUrl: "",
  };
  const collection = new SbtCollection(collectionData);

  const mintParams: SbtMintParams = {
    queryId: 0,
    itemOwnerAddress: Address.parse(ownerAddress),
    itemIndex: sbtIndex,
    amount: toNano("0.055"),
    commonContentUrl: sbtMetadataUrl,
    authorityAddress: parsedAuthority,
  };

  const beforeSeqno = await wallet.contract.getSeqno();
  logger.log(`mintSBT: Sending mint message for item ${sbtIndex}, seqno: ${beforeSeqno}`);

  await wallet.contract.sendTransfer({
    seqno: beforeSeqno,
    secretKey: wallet.keyPair.secretKey,
    messages: [
      internal({
        value: "0.055",
        to: collectionAddress,
        body: collection.createMintBody(mintParams),
      }),
    ],
    sendMode: SendMode.IGNORE_ERRORS + SendMode.PAY_GAS_SEPARATELY,
  });

  const seqnoAfter = await waitSeqno(beforeSeqno, wallet);
  logger.log(`mintSBT: Mint message confirmed at seqno ${seqnoAfter}`);

  return {
    itemAddress: deterministicItemAddress.toString(),
  };
}

/**
 * Revokes a Soulbound Token using the authority wallet.
 */
export async function revokeSBT(
  itemAddress: string,
  options?: SbtWalletOptions
): Promise<boolean> {
  const { mnemonic } = extractWalletOptions(options);
  const mnemonicSource = mnemonic ?? process.env.MNEMONIC ?? "";
  const mnemonicWords = mnemonicSource.split(" ").filter(Boolean);
  if (mnemonicWords.length === 0) {
    logger.error("revokeSBT: MNEMONIC is not configured or empty");
    return false;
  }

  const wallet = await openWallet(mnemonicWords);
  const beforeSeqno = await wallet.contract.getSeqno();

  await wallet.contract.sendTransfer({
    seqno: beforeSeqno,
    secretKey: wallet.keyPair.secretKey,
    messages: [
      internal({
        value: "0.03",
        to: itemAddress,
        body: SbtItem.createRevokeBody(),
      }),
    ],
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
  });

  const seqnoAfter = await waitSeqno(beforeSeqno, wallet);
  return seqnoAfter > beforeSeqno;
}
