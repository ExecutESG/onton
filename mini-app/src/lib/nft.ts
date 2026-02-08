import tonCenter, { v2_client } from "@/services/tonCenter";
import { Address, Cell, internal, beginCell, contractAddress, StateInit, SendMode, OpenedContract, toNano } from "@ton/core";

import { KeyPair, mnemonicToPrivateKey } from "@ton/crypto";
import { TonClient, WalletContractV4 } from "@ton/ton";
import { logger } from "@/server/utils/logger";
import { config } from "@/server/config";
import * as dotenv from "dotenv";

dotenv.config();

// logger.log(process.env.MNEMONIC);

export type OpenedWallet = {
  contract: OpenedContract<WalletContractV4>;
  keyPair: KeyPair;
};

export async function openWallet(mnemonic: string[]) {
  const keyPair = await mnemonicToPrivateKey(mnemonic);

  const client = v2_client();

  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keyPair.publicKey,
  });

  const contract = client.open(wallet);
  return { contract, keyPair };
}

function bufferToChunks(buff: Buffer, chunkSize: number) {
  const chunks: Buffer[] = [];
  while (buff.byteLength > 0) {
    chunks.push(buff.subarray(0, chunkSize));
    buff = buff.subarray(chunkSize);
  }
  return chunks;
}

function makeSnakeCell(data: Buffer): Cell {
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

export function encodeOffChainContent(content: string) {
  let data = Buffer.from(content);
  const offChainPrefix = Buffer.from([0x01]);
  data = Buffer.concat([offChainPrefix, data]);
  return makeSnakeCell(data);
}

export type collectionData = {
  ownerAddress: Address;
  royaltyPercent: number;
  royaltyAddress: Address;
  nextItemIndex: number;
  collectionContentUrl: string;
  commonContentUrl: string;
};

export class NftCollection {
  private collectionData: collectionData;

  constructor(collectionData: collectionData) {
    this.collectionData = collectionData;
  }

  private createCodeCell(): Cell {
    const NftCollectionCodeBoc =
      "te6cckECFAEAAh8AART/APSkE/S88sgLAQIBYgkCAgEgBAMAJbyC32omh9IGmf6mpqGC3oahgsQCASAIBQIBIAcGAC209H2omh9IGmf6mpqGAovgngCOAD4AsAAvtdr9qJofSBpn+pqahg2IOhph+mH/SAYQAEO4tdMe1E0PpA0z/U1NQwECRfBNDUMdQw0HHIywcBzxbMyYAgLNDwoCASAMCwA9Ra8ARwIfAFd4AYyMsFWM8WUAT6AhPLaxLMzMlx+wCAIBIA4NABs+QB0yMsCEsoHy//J0IAAtAHIyz/4KM8WyXAgyMsBE/QA9ADLAMmAE59EGOASK3wAOhpgYC42Eit8H0gGADpj+mf9qJofSBpn+pqahhBCDSenKgpQF1HFBuvgoDoQQhUZYBWuEAIZGWCqALnixJ9AQpltQnlj+WfgOeLZMAgfYBwGyi544L5cMiS4ADxgRLgAXGBEuAB8YEYGYHgAkExIREAA8jhXU1DAQNEEwyFAFzxYTyz/MzMzJ7VTgXwSED/LwACwyNAH6QDBBRMhQBc8WE8s/zMzMye1UAKY1cAPUMI43gED0lm+lII4pBqQggQD6vpPywY/egQGTIaBTJbvy9AL6ANQwIlRLMPAGI7qTAqQC3gSSbCHis+YwMlBEQxPIUAXPFhPLP8zMzMntVABgNQLTP1MTu/LhklMTugH6ANQwKBA0WfAGjhIBpENDyFAFzxYTyz/MzMzJ7VSSXwXiN0CayQ==";
    return Cell.fromBase64(NftCollectionCodeBoc);
  }

  private createDataCell(): Cell {
    const data = this.collectionData;
    const dataCell = beginCell();

    dataCell.storeAddress(data.ownerAddress);
    dataCell.storeUint(data.nextItemIndex, 64);
    const contentCell = beginCell();

    const collectionContent = encodeOffChainContent(data.collectionContentUrl);

    const commonContent = beginCell();
    commonContent.storeBuffer(Buffer.from(data.commonContentUrl));

    contentCell.storeRef(collectionContent);
    contentCell.storeRef(commonContent.asCell());
    dataCell.storeRef(contentCell);
    const NftItemCodeCell = Cell.fromBase64(
      "te6cckECDQEAAdAAART/APSkE/S88sgLAQIBYgMCAAmhH5/gBQICzgcEAgEgBgUAHQDyMs/WM8WAc8WzMntVIAA7O1E0NM/+kAg10nCAJp/AfpA1DAQJBAj4DBwWW1tgAgEgCQgAET6RDBwuvLhTYALXDIhxwCSXwPg0NMDAXGwkl8D4PpA+kAx+gAxcdch+gAx+gAw8AIEs44UMGwiNFIyxwXy4ZUB+kDUMBAj8APgBtMf0z+CEF/MPRRSMLqOhzIQN14yQBPgMDQ0NTWCEC/LJqISuuMCXwSED/LwgCwoAcnCCEIt3FzUFyMv/UATPFhAkgEBwgBDIywVQB88WUAX6AhXLahLLH8s/Im6zlFjPFwGRMuIByQH7AAH2UTXHBfLhkfpAIfAB+kDSADH6AIIK+vCAG6EhlFMVoKHeItcLAcMAIJIGoZE24iDC//LhkiGOPoIQBRONkchQCc8WUAvPFnEkSRRURqBwgBDIywVQB88WUAX6AhXLahLLH8s/Im6zlFjPFwGRMuIByQH7ABBHlBAqN1viDACCAo41JvABghDVMnbbEDdEAG1xcIAQyMsFUAfPFlAF+gIVy2oSyx/LPyJus5RYzxcBkTLiAckB+wCTMDI04lUC8ANqhGIu"
    );
    dataCell.storeRef(NftItemCodeCell);
    const royaltyBase = 1000;
    const royaltyFactor = Math.floor(data.royaltyPercent * royaltyBase);
    const royaltyCell = beginCell();
    royaltyCell.storeUint(royaltyFactor, 16);
    royaltyCell.storeUint(royaltyBase, 16);
    royaltyCell.storeAddress(data.royaltyAddress);
    dataCell.storeRef(royaltyCell);

    return dataCell.endCell();
  }

  public get stateInit(): StateInit {
    const code = this.createCodeCell();
    const data = this.createDataCell();

    return { code, data };
  }

  public get address(): Address {
    return contractAddress(0, this.stateInit);
  }

  public createMintBodyAutoIndex(params: mintParams): Cell {
    const body = beginCell();
    body.storeUint(1, 32); // op
    body.storeUint(params.queryId || 0, 64);
    // store 0xFFFFFFFF for item index
    body.storeUint(0xffffffff, 64);

    body.storeCoins(params.amount);

    const nftItemContent = beginCell();
    nftItemContent.storeAddress(params.itemOwnerAddress);

    const offChainCell = encodeOffChainContent(params.commonContentUrl);
    nftItemContent.storeRef(offChainCell);

    body.storeRef(nftItemContent.endCell());
    return body.endCell();
  }

  public createMintBody(params: mintParams): Cell {
    const body = beginCell();
    body.storeUint(1, 32);
    body.storeUint(params.queryId || 0, 64);
    body.storeUint(params.itemIndex, 64);
    body.storeCoins(params.amount);
    const nftItemContent = beginCell();
    nftItemContent.storeAddress(params.itemOwnerAddress);
    const offChainCell = encodeOffChainContent(params.commonContentUrl);
    nftItemContent.storeRef(offChainCell);
    body.storeRef(nftItemContent.endCell());
    logger.log(`params.commonContentUrl : `, params.commonContentUrl);
    return body.endCell();
  }

  public async deploy(wallet: OpenedWallet) {
    const seqno = await wallet.contract.getSeqno();

    await wallet.contract.sendTransfer({
      seqno,
      secretKey: wallet.keyPair.secretKey,
      messages: [
        internal({
          value: "0.055",
          to: this.address,
          init: this.stateInit,
        }),
      ],
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    });

    return seqno;
  }

  public async topUpBalance(wallet: OpenedWallet, nftAmount: number): Promise<number> {
    const feeAmount = 0.026; // approximate value of fees for 1 transaction in our case
    const seqno = await wallet.contract.getSeqno();
    const amount = nftAmount * feeAmount;

    await wallet.contract.sendTransfer({
      seqno,
      secretKey: wallet.keyPair.secretKey,
      messages: [
        internal({
          value: amount.toString(),
          to: this.address.toString({ bounceable: false }),
          body: new Cell(),
        }),
      ],
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    });

    return seqno;
  }
}

export async function waitSeqno(seqno: number, wallet: OpenedWallet) {
  let seqnoAfter = -1;
  for (let attempt = 0; attempt < 10; attempt++) {
    await sleep(2000);
    seqnoAfter = await wallet.contract.getSeqno();
    if (seqnoAfter == seqno + 1) break;
  }
  return seqnoAfter;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type mintParams = {
  queryId: number | null;
  itemOwnerAddress: Address;
  itemIndex: number;
  amount: bigint;
  commonContentUrl: string;
  color?: string;
};

export class NftItem {
  private collection: NftCollection;

  constructor(collection: NftCollection) {
    this.collection = collection;
  }

  public async deploy(wallet: OpenedWallet, params: mintParams, collection_address: string): Promise<number> {
    const seqNo = await wallet.contract.getSeqno();
    logger.log(`deploy NFT: seqNo : `, seqNo);
    const response = await wallet.contract.sendTransfer({
      seqno: seqNo,
      secretKey: wallet.keyPair.secretKey,
      messages: [
        internal({
          value: "0.055",
          to: collection_address,
          body: this.collection.createMintBody(params),
        }),
      ],
      sendMode: SendMode.IGNORE_ERRORS + SendMode.PAY_GAS_SEPARATELY,
    });
    logger.log(`mintNFT: deploy sendTransfer response : `, response);
    const seqnoAfter = await waitSeqno(seqNo, wallet);
    if (seqnoAfter % 5 === 0) {
      logger.log("mintNFT: waitSeqno: seq after mint : ", seqnoAfter);
      await sleep(20000); // wait to avoid fee increase
    }
    logger.log("mintNFT: seq after mint : ", seqnoAfter);
    return seqNo;
  }

  static async getAddressByIndex(collectionAddress: string, itemIndex: number) {
    const response = await tonCenter.fetchNFTItemsWithRetry("", collectionAddress, "", itemIndex);

    if (response?.nft_items && response?.nft_items.length) {
      return response?.nft_items[0].address;
    }
    return null;
  }
}

type MintWalletOptions = string | { mnemonic?: string; expectedMinterAddress?: string };

function extractWalletOptions(options?: MintWalletOptions): {
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

export async function mintNFT(
  owner_address: string,
  collection_address: string,
  nftIndex: number | null,
  nft_metadata_url: string,
  options?: MintWalletOptions
): Promise<string | null> {
  if (nftIndex === null) {
    const result = await tonCenter.fetchCollection(collection_address);
    nftIndex = Number(result?.nft_collections[0]?.next_item_index);
  }
  logger.log(`mintNFT: getAddressByIndex ${nftIndex} for address : ${owner_address} for collection : ${collection_address}`);
  let nft_addres = await NftItem.getAddressByIndex(collection_address, nftIndex);
  if (nft_addres) return nft_addres;

  const { mnemonic, expectedMinterAddress } = extractWalletOptions(options);
  const mnemonicSource = mnemonic ?? process.env.MNEMONIC ?? "";
  const mnemonicWords = mnemonicSource.split(" ").filter(Boolean);
  if (mnemonicWords.length === 0) {
    logger.error("mintNFT: MNEMONIC is not configured or empty");
    return null;
  }

  const wallet = await openWallet(mnemonicWords);
  logger.log(`mintNFT: openWallet minting nft address : ${nft_addres} `, wallet.contract.address);

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
    logger.error("mintNFT: mnemonic address mismatch", {
      expected: normalizedExpected,
      derived: normalizedWalletAddress,
    });
    return null;
  }

  const collectionData = {
    ownerAddress: wallet.contract.address,
    royaltyPercent: 0.1, // 0.1 = 10%
    royaltyAddress: wallet.contract.address,
    nextItemIndex: nftIndex,
    collectionContentUrl: "",
    commonContentUrl: "",
  };
  const collection = new NftCollection(collectionData);

  const mintParams = {
    queryId: 0,
    itemOwnerAddress: Address.parse(owner_address),
    itemIndex: nftIndex,
    amount: toNano("0.055"),
    commonContentUrl: nft_metadata_url,
  };
  logger.log(`mintNFT:  minting nft address one : ${nft_addres} mintParams:`, mintParams);
  const beforeSeqno = await wallet.contract.getSeqno();
  logger.log("mintNFT:seq before mint : ", beforeSeqno);
  const nftItem = new NftItem(collection);
  logger.log(`mintNFT:Deploying the ${nftIndex + 1}th NFT...`);
  const seqno = await nftItem.deploy(wallet, mintParams, collection_address);
  logger.log(`mintNFT: Successfully deployed the ${nftIndex + 1}th NFT`);

  await sleep(22000); // just wait to make sure nft is minted
  logger.log(
    `mintNFT: getting nft address for index : ${nftIndex} for address : ${owner_address} for collection : ${collection_address}`
  );
  nft_addres = await NftItem.getAddressByIndex(collection_address, nftIndex);
  logger.log(`mintNFT: getAddressByIndex nft address : ${nft_addres}`);
  if (nft_addres) return nft_addres;
  logger.error(
    `mintNFT: 🔴 getAddressByIndex failed to get nft address for index : ${nftIndex} for address : ${owner_address} for collection : ${collection_address}`
  );
  return null;
}

export async function deployCollection(
  collectio_metadata_url: string,
  options?: MintWalletOptions
): Promise<string | null> {
  const { mnemonic, expectedMinterAddress } = extractWalletOptions(options);
  const mnemonicSource = mnemonic ?? process.env.MNEMONIC ?? "";
  const mnemonicWords = mnemonicSource.split(" ").filter(Boolean);
  if (mnemonicWords.length === 0) {
    logger.error("deployCollection: MNEMONIC is not configured or empty");
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
    logger.error("deployCollection: mnemonic address mismatch", {
      expected: normalizedExpected,
      derived: normalizedWalletAddress,
    });
    return null;
  }

  logger.log("Start deploy of nft collection...");
  const collectionData = {
    ownerAddress: wallet.contract.address,
    royaltyPercent: 0.1, // 0.1 = 10%
    royaltyAddress: wallet.contract.address,
    nextItemIndex: 0,
    collectionContentUrl: collectio_metadata_url,
    commonContentUrl: "",
  };
  const collection = new NftCollection(collectionData);
  let seqno = await collection.deploy(wallet);
  logger.log(`Collection deployed: ${collection.address}`);
  await waitSeqno(seqno, wallet);
  await sleep(1500);
  logger.log(`Collection deployed Completely ..... `);

  return collection.address.toString();
}
