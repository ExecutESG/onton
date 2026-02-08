import { Address, Cell } from "@ton/core";
import axios from "axios";
import { TonClient } from "@ton/ton";
import { is_local_env, is_prod_env, is_stage_env } from "@/server/utils/evnutils";
import { logger } from "@/server/utils/logger";
import { sleep } from "@/utils";

// Network selection follows ENV: production => mainnet, otherwise testnet
export const is_mainnet = is_prod_env();
/* -------------------------------------------------------------------------- */
/*                                   API KEY                                  */
/* -------------------------------------------------------------------------- */
const apiKeys = is_mainnet
  ? [
      "f8b7d29d6a483410d47e4452caab2e2753fa3950bc9967c865d3b2d8294190cb",
      "2a5b072391515cf78962b00ef4b6d574781bb9918927cea35a32c4687b334243",
      "51a79c3e82d6fb3a97360a6406f955e25bd787c75a0fa37ab5383291b20c825c",
      "56f164ae58ab79ade2d4ae1ecb5a1717c320f69aa9b3c52c6069c90a9bbc7552",
    ]
  : ["4fb3c0656555c4f63de82e91f978285e88ea0738389c05365220dee7bdfe1c84"];

/* --------------------------- ONTON ORDER PREFIX --------------------------- */
const ORDER_PREFIX = "onton_order=";

const BASE_URL = is_mainnet ? "https://toncenter.com/api/v3" : "https://testnet.toncenter.com/api/v3";
//user contract address
const USDT_CADDRESS = is_mainnet
  ? "0:B113A994B5024A16719F69139328EB759596C38A25F59028B146FECDC3621DFE"
  : "0:F418A04CF196EBC959366844A6CDF53A6FD6FFF1EADAFC892F05210BBA31593E";

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

// Function to cycle through API keys
export const getApiKey = (() => {
  let index = 0;

  return function () {
    const apiKey = apiKeys[index];
    index = (index + 1) % apiKeys.length; // Update index for next call
    return apiKey;
  };
})();

export function v2_client() {
  const toncenterBaseEndpoint: string = !is_mainnet ? "https://testnet.toncenter.com" : "https://toncenter.com";
  logger.log("toncenterBaseEndpoint", toncenterBaseEndpoint, "is_mainnet", is_mainnet);
  const client = new TonClient({
    endpoint: `${toncenterBaseEndpoint}/api/v2/jsonRPC`,
    apiKey: getApiKey(),
  });

  return client;
}

function v2_base_url() {
  return !is_mainnet ? "https://testnet.toncenter.com" : "https://toncenter.com";
}

/* -------------------------------------------------------------------------- */
/*                                  FETCH NFT                                 */

/* -------------------------------------------------------------------------- */

export interface NFTItem {
  address: string;
  init: boolean;
  index: string;
  collection_address: string;
  owner_address: string;
  content: {
    uri: string;
  };
  last_transaction_lt: string;
  code_hash: string;
  data_hash: string;
  collection: {
    address: string;
    owner_address: string;
    last_transaction_lt: string;
    next_item_index: string;
    collection_content: {
      uri: string;
    };
    data_hash: string;
    code_hash: string;
  };
}

interface AddressBook {
  [key: string]: {
    user_friendly: string;
  };
}

interface TonCenterResponse {
  nft_items: NFTItem[];
  address_book: AddressBook;
}

// Function to fetch NFT items
export async function fetchNFTItems(
  ownerAddress: string,
  collectionAddress: string,
  nft_address: string = "",
  index: number = -1,
  limit: number = 100,
  offset: number = 0
): Promise<TonCenterResponse> {
  let url: string = "";
  if (ownerAddress && collectionAddress) {
    url = `${BASE_URL}/nft/items?owner_address=${ownerAddress}&collection_address=${collectionAddress}&limit=${limit}&offset=${offset}`;
  } else if (nft_address && ownerAddress) {
    url = `${BASE_URL}/nft/items?address=${nft_address}&owner_address=${ownerAddress}`;
  } else if (index > -1 && collectionAddress) {
    url = `${BASE_URL}/nft/items?index=${index}&collection_address=${collectionAddress}`;
  } else if (index === -1 && collectionAddress) {
    url = `${BASE_URL}/nft/items?collection_address=${collectionAddress}&limit=${limit}&offset=${offset}`;
  } else {
    throw Error("Wrong Params");
  }

  const apiKey = getApiKey();
  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      "X-Api-Key": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Error fetching data: ${response.statusText} , collection: ${collectionAddress} owner: ${ownerAddress} nft: ${nft_address} response: ${response.text} `
    );
  }

  const data: TonCenterResponse = await response.json();
  return data;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Function to fetch NFT items with retry
async function fetchNFTItemsWithRetry(
  ownerAddress: string,
  collectionAddress: string,
  nft_address: string = "",
  index: number = -1,
  limit: number = 100,
  offset: number = 0,
  retries: number = 3, // Number of retries
  delayMs: number = 1000 // Delay between retries (in milliseconds)
): Promise<TonCenterResponse | undefined> {
  let attempt = 0;

  while (attempt < retries) {
    try {
      // Call fetchNFTItems function
      logger.log(
        `fetchNFTItemsWithRetry: Attempt ${attempt + 1} for ownerAddress ${ownerAddress} collectionAddress ${collectionAddress} nft_address ${nft_address}`
      );
      const result = await fetchNFTItems(ownerAddress, collectionAddress, nft_address, index, limit, offset);
      logger.log(
        `fetchNFTItemsWithRetry compeleted: Attempt ${attempt + 1} successful for ownerAddress ${ownerAddress} collectionAddress ${collectionAddress} nft_address ${nft_address} result:`,
        result
      );
      return result; // Return the result if successful
    } catch (error) {
      attempt++;
      if (attempt >= retries) {
        throw new Error(`Failed after ${retries} retries: ${error}`);
      }
      logger.log(`Retrying... Attempt ${attempt} of ${retries}`);
      await delay(delayMs); // Wait before retrying
    }
  }
}

async function fetchCollection(collection_address: string, limit: number = 100, retries = 3): Promise<any> {
  const endpoint = `${BASE_URL}/nft/collections`;
  const params: Record<string, any> = { collection_address, limit };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const apiKey = getApiKey();
      const response = await axios.get(endpoint, {
        params,
        headers: { accept: "application/json", "X-Api-Key": apiKey },
      });
      return response.data;
    } catch (error) {
      await delay(50);
      if (attempt === retries) {
        logger.log(`fetchCollection Failed after ${retries} attempts`);
        throw error;
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                                Jetton Wallet                               */

/* -------------------------------------------------------------------------- */

export async function getJettonWallet(
  address: string,
  {
    retries = 3,
    limit = 50,
    offset = 0,
    jettonAddress,
  }: { retries?: number; limit?: number; offset?: number; jettonAddress?: string } = {}
) {
  const endpoint = `${BASE_URL}/jetton/wallets`;
  const params: Record<string, any> = { owner_address: address, limit, offset };
  if (jettonAddress) params.jetton_address = jettonAddress;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const apiKey = getApiKey();
      const response = await axios.get(endpoint, {
        params,
        headers: { accept: "application/json", "X-Api-Key": apiKey },
      });
      return response.data;
    } catch (error) {
      if (attempt === retries) {
        throw new Error(`getJettonWallet Failed after ${retries} attempts`);
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                                Transactions                                */

/* -------------------------------------------------------------------------- */
interface FetchTransactionsParams {
  account: string;
  start_utime: number | null;
  limit: number;
  sort: "asc" | "desc";
  start_lt: bigint | null;
  retries?: number;
  offset?: number;
}

async function fetchTransactions({
  account,
  start_utime,
  limit,
  sort,
  start_lt,
  offset = 0,
  retries = 3, // Default retry count
}: FetchTransactionsParams): Promise<any> {
  const endpoint = `${BASE_URL}/transactions`;
  const params: Record<string, any> = { account, limit, offset, sort };
  if (start_lt) {
    params.start_lt = start_lt;
  } else if (start_utime) {
    params.start_utime = start_utime;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const apiKey = getApiKey();
      const response = await axios.get(endpoint, {
        params,
        headers: { accept: "application/json", "X-Api-Key": apiKey },
      });
      return response.data;
    } catch (error) {
      await delay(50);
      if (attempt === retries) {
        throw error;
        throw new Error(`fetchTransactions Failed after ${retries} attempts`);
      }
    }
  }
}

async function fetchAllTransactions(
  account: string,
  start_utime: number | null = null,
  start_lt: bigint | null = null,
  limit = 100,
  sort = "asc"
) {
  let allTransactions = [];
  let offset = 0;
  while (true) {
    const response = await fetchTransactions({
      account,
      start_utime,
      start_lt,
      limit,
      sort: sort as "asc" | "desc",
      offset: offset,
    });

    if (!response || !response.transactions || response.transactions.length === 0) {
      break;
    }
    logger.info("fetchAllTransactions: response: ", response);
    allTransactions.push(...response.transactions);

    offset += limit;
  }

  return allTransactions;
}

// Parse Jetton transactions
// Check if this jetton transactions have comment and if they do
// Add the comment and jetton type to transaction
type Transaction = Record<string, any>;
type InMsg = {
  source: string | null;
  destination: string | null;
  opcode: string;
  value: number;
  created_at: string;
  message_content: {
    hash: string;
    body: string;
    decoded: {
      type: string;
      comment: string;
    };
  };
};
type OrderTransaction = {
  rawAmount: bigint;
  order_uuid: string;
  kind: "ton" | "jetton";
  verfied: boolean;
  owner: Address;
  trx_hash: string;
  jettonMaster?: string;
};

async function parseTransactions(
  transactions: Transaction[],
  ORDER_PREFIX: string = "onton_order="
): Promise<OrderTransaction[]> {
  const orders: OrderTransaction[] = [];
  for (const trx of transactions) {
    // logger.log(trx.hash);
    const in_msg: InMsg | null = trx?.in_msg;
    if (!in_msg) continue;

    const source = in_msg.source;
    const destination = in_msg.destination;
    const message_content = in_msg.message_content;
    const created_at = in_msg.created_at;
    const opcode = in_msg.opcode;

    if (!source || !destination || opcode === undefined || opcode === null || !message_content) continue;

    if (opcode === "0x00000000") {
      //Ton Transfer with comment
      const decoded = message_content.decoded;
      if (decoded) {
        const comment = decoded.comment;
        // logger.log(comment);
        if (comment.startsWith(ORDER_PREFIX)) {
          orders.push({
            order_uuid: comment.replace(ORDER_PREFIX, ""),
            rawAmount: BigInt(Math.round(Number(in_msg.value))),
            kind: "ton",
            verfied: true,
            owner: Address.parse(source),
            trx_hash: trx?.hash,
          });
        }
      }
    } else if (opcode === "0x7362d09c") {
      const cell = Cell.fromBase64(in_msg.message_content.body);
      const originalBody = cell.beginParse();
      let body = originalBody.clone();
      const op = body.loadUint(32);
      if (op !== 0x7362d09c) continue;
      // if opcode is 0x7362d09c: it's a Jetton transfer notification

      body.skip(64); // skip query_id
      const jettonAmount = body.loadCoins();
      const jettonSender = body.loadAddressAny();
      const originalForwardPayload = body.loadBit() ? body.loadRef().beginParse() : body;
      let forwardPayload = originalForwardPayload.clone();

      // IMPORTANT: we have to verify the source of this message because it can be faked
      const jetton_wallet_data = await getJettonWallet(source).catch((err) => {
        console.warn("Failed to fetch jetton wallet data", err);
        return null;
      });
      const jetton_master = jetton_wallet_data?.jetton_wallets?.[0]?.jetton ?? "";
      // logger.log("jetton_master" , jetton_master)

      if (forwardPayload.remainingBits > 32) {
        const forwardOp = forwardPayload.loadUint(32);
        if (forwardOp == 0) {
          // if forward payload opcode is 0: it's a simple Jetton transfer with comment
          const comment = forwardPayload.loadStringTail();
          // logger.log('jetton commnet ====>' , comment , comment.startsWith(ORDER_PREFIX))
          // logger.log(jetton_master , USDT_CADDRESS)
          if (comment.startsWith(ORDER_PREFIX)) {
            orders.push({
              order_uuid: comment.replace(ORDER_PREFIX, ""),
              rawAmount: jettonAmount,
              kind: "jetton",
              jettonMaster: jetton_master,
              verfied: Boolean(jetton_master),
              owner: Address.parse(jettonSender?.toString()!),
              trx_hash: trx?.hash,
            });
          }
        }
      }

      //Jetton transfer with comment
    }
  }
  return orders;
}

/* -------------------------------------------------------------------------- */
/*                                  Accont State                              */

/* -------------------------------------------------------------------------- */
interface TonCenterAccountStatesResponse {
  accounts: Array<{
    account_state_hash: string;
    address: string;
    balance: string; // in nanoTON
    code_boc?: string;
    code_hash?: string;
    data_boc?: string;
    data_hash?: string;
    extra_currencies?: Record<string, string>;
    frozen_hash?: string;
    last_transaction_hash?: string;
    last_transaction_lt?: string;
    status?: string;
  }>;
  address_book?: Record<
    string,
    {
      domain?: string;
      user_friendly?: string;
    }
  >;
  metadata?: any;
}

export async function getAccountBalance(address: string, retries = 3): Promise<number> {
  // Build the endpoint with query param
  const endpoint = `${BASE_URL}/accountStates`;
  const params = { address: address };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await sleep(30);
      const apiKey = getApiKey();
      logger.log(
        `getAccountBalance: Attempt ${attempt} for address ${address} using apiKey ${apiKey} , params: ${JSON.stringify(params)} , endpoint: ${endpoint}`
      );
      // Make the request with axios
      const response = await axios.get<TonCenterAccountStatesResponse>(endpoint, {
        params,
        headers: {
          accept: "application/json",
          "X-Api-Key": apiKey,
        },
      });

      // Extract data
      const data = response.data;
      if (!data.accounts || data.accounts.length === 0) {
        throw new Error(`No account data returned for address: ${address}`);
      }

      const accountInfo = data.accounts[0];
      if (!accountInfo.balance) {
        throw new Error(`Account has no 'balance' field. Full item: ${JSON.stringify(accountInfo)}`);
      }

      // Convert from nanoTON (string) -> number (TON)
      const nanoBalance = parseInt(accountInfo.balance, 10);
      const tonBalance = nanoBalance / 1e9;

      return tonBalance; // Return in TON units
    } catch (error) {
      // Retry logic

      if (attempt === retries) {
        throw new Error(`getAccountBalance failed after ${retries} retries for ${address}. Last error: ${error}`);
      }
      logger.error(`Attempt #${attempt} to fetch account balance failed. Error: ${error}`);
      await delay(100); // small delay before next retry
    }
  }

  // Fallback in case all attempts fail
  throw new Error("Failed to fetch account balance after multiple retries.");
}

/* -------------------------------------------------------------------------- */
/*                      Wallet info via v2 (robust for init)                  */
/* -------------------------------------------------------------------------- */
export async function getWalletInformationBalance(address: string, retries = 3): Promise<number> {
  const endpoint = `${v2_base_url()}/api/v2/getWalletInformation`;
  const params = { address };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const apiKey = getApiKey();
      logger.log(
        `getWalletInformationBalance: Attempt ${attempt} for address ${address} , endpoint: ${endpoint}`
      );
      const response = await axios.get(endpoint, {
        params,
        headers: { accept: "application/json", "X-Api-Key": apiKey },
      });

      const data: any = response.data;
      // TonCenter v2 typically returns { ok, result: { balance: <nanoton>|"<nanoton>" , ... } }
      const raw = data?.result?.balance ?? data?.balance;
      if (raw === undefined || raw === null) {
        throw new Error(`No balance in v2 payload: ${JSON.stringify(data)?.slice(0, 256)}`);
      }
      const nano = typeof raw === "string" ? parseInt(raw, 10) : Number(raw);
      if (!Number.isFinite(nano)) {
        throw new Error(`Invalid numeric balance in v2 payload: ${raw}`);
      }
      const ton = nano / 1e9;
      return ton;
    } catch (error) {
      if (attempt === retries) {
        throw new Error(
          `getWalletInformationBalance failed after ${retries} retries for ${address}. Last error: ${error}`
        );
      }
      logger.error(`Attempt #${attempt} to fetch v2 wallet information failed. Error: ${error}`);
      await delay(100);
    }
  }

  throw new Error("Failed to fetch wallet information after multiple retries.");
}

/* -------------------------------------------------------------------------- */
/*                                     END                                    */
/* -------------------------------------------------------------------------- */

const tonCenter = {
  fetchNFTItemsWithRetry,
  fetchTransactions,
  fetchAllTransactions,
  parseTransactions,
  fetchCollection,
  getAccountBalance,
  getWalletInformationBalance,
};

export default tonCenter;
