import { Page } from "@playwright/test";
import nacl from "../../../mini-app/node_modules/tweetnacl";
import { sha256 } from "../../../mini-app/node_modules/@ton/crypto";
import { Address, WalletContractV4, beginCell, storeStateInit } from "../../../mini-app/node_modules/@ton/ton";

export interface HeadlessTonWalletConfig {
  secretKey?: Uint8Array;
  publicKey?: Uint8Array;
  domain?: string;
  network?: "-239" | "-3"; // Mainnet or Testnet
}

export interface GeneratedWalletSession {
  rawAddress: string;
  userFriendlyAddress: string;
  publicKeyHex: string;
  secretKeyHex: string;
  stateInitBase64: string;
}

/**
 * Generates a fresh, valid TON V4R2 wallet keypair, address, and stateInit.
 */
export function generateTonTestWallet(): {
  keyPair: nacl.SignKeyPair;
  rawAddress: string;
  userFriendlyAddress: string;
  publicKeyHex: string;
  stateInitBase64: string;
} {
  const keyPair = nacl.sign.keyPair();
  const publicKeyBuffer = Buffer.from(keyPair.publicKey);
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: publicKeyBuffer });
  const rawAddress = wallet.address.toRawString();
  const userFriendlyAddress = wallet.address.toString({ bounceable: false, testOnly: true });
  const stateInitCell = beginCell().store(storeStateInit(wallet.init)).endCell();
  const stateInitBase64 = stateInitCell.toBoc().toString("base64");

  return {
    keyPair,
    rawAddress,
    userFriendlyAddress,
    publicKeyHex: publicKeyBuffer.toString("hex"),
    stateInitBase64,
  };
}

/**
 * Creates a cryptographically valid TonProof signature according to the official TON Connect 2.0 specification.
 */
export async function createTonProofSignature(
  rawAddress: string,
  keyPair: nacl.SignKeyPair,
  payload: string,
  domainValue: string = "app.dev.onton.live"
): Promise<{
  timestamp: number;
  domain: { lengthBytes: number; value: string };
  payload: string;
  signature: string;
}> {
  const domain = {
    lengthBytes: Buffer.byteLength(domainValue),
    value: domainValue,
  };
  const timestamp = Math.floor(Date.now() / 1000);

  const parsedAddress = Address.parse(rawAddress);
  const wc = Buffer.alloc(4);
  wc.writeUInt32BE(parsedAddress.workChain, 0);

  const ts = Buffer.alloc(8);
  ts.writeBigUInt64LE(BigInt(timestamp), 0);

  const dl = Buffer.alloc(4);
  dl.writeUInt32LE(domain.lengthBytes, 0);

  // message = "ton-proof-item-v2/" ++ WorkChain ++ AddressHash ++ DomainLength ++ DomainValue ++ Timestamp ++ Payload
  const msg = Buffer.concat([
    Buffer.from("ton-proof-item-v2/"),
    wc,
    parsedAddress.hash,
    dl,
    Buffer.from(domain.value),
    ts,
    Buffer.from(payload),
  ]);

  const msgHash = Buffer.from(await sha256(msg));
  const fullMsg = Buffer.concat([Buffer.from([0xff, 0xff]), Buffer.from("ton-connect"), msgHash]);
  const resultToSign = Buffer.from(await sha256(fullMsg));

  const signature = Buffer.from(nacl.sign.detached(resultToSign, keyPair.secretKey)).toString("base64");

  return {
    timestamp,
    domain,
    payload,
    signature,
  };
}

/**
 * Injects a compliant Headless Tonkeeper provider into the browser window.
 * When TonConnect UI opens, it instantly recognizes the wallet as installed and can connect automatically.
 */
export async function injectHeadlessTonWallet(
  page: Page,
  config: HeadlessTonWalletConfig = {}
): Promise<GeneratedWalletSession> {
  const walletData = generateTonTestWallet();
  const rawAddress = walletData.rawAddress;
  const userFriendlyAddress = walletData.userFriendlyAddress;
  const publicKeyHex = walletData.publicKeyHex;
  const secretKeyHex = Buffer.from(walletData.keyPair.secretKey).toString("hex");
  const stateInitBase64 = walletData.stateInitBase64;
  const domain = config.domain || "app.dev.onton.live";
  const network = config.network || "-3";

  await page.addInitScript(
    ({ rawAddress, publicKeyHex, stateInitBase64, domain, network, secretKeyHex }) => {
      // In-page mock of TonConnect JS Bridge
      const listeners: Array<(event: any) => void> = [];

      // Create a mock Ed25519 signature generator for in-browser proofs
      function signProof(payload: string) {
        return {
          timestamp: Math.floor(Date.now() / 1000),
          domain: { lengthBytes: domain.length, value: domain },
          payload: payload,
          signature: "injected_headless_proof_signature_base64",
        };
      }

      // @ts-ignore
      window.tonkeeper = {
        tonconnect: {
          device: {
            platform: "browser",
            appName: "Tonkeeper",
            appVersion: "1.0.0",
            maxProtocolVersion: 2,
            features: [
              "SendTransaction",
              { name: "SendTransaction", maxMessages: 4 },
            ],
          },
          walletInfo: {
            name: "Tonkeeper",
            app_name: "tonkeeper",
            image: "https://tonkeeper.com/assets/tonconnect-icon.png",
            about_url: "https://tonkeeper.com",
            platforms: ["chrome", "firefox", "safari", "ios", "android"],
            features: [
              "SendTransaction",
              { name: "SendTransaction", maxMessages: 4 },
            ],
          },
          isWalletBrowser: false,
          protocolVersion: 2,

          connect: async (protocolVersion: number, message: any) => {
            let tonProofItem: any = null;
            if (message?.items) {
              const proofReq = message.items.find((item: any) => item.name === "ton_proof");
              if (proofReq) {
                tonProofItem = {
                  name: "ton_proof",
                  proof: signProof(proofReq.payload),
                };
              }
            }

            const connectSuccessEvent = {
              event: "connect",
              id: Date.now(),
              payload: {
                items: [
                  {
                    name: "ton_addr",
                    address: rawAddress,
                    network: network,
                    publicKey: publicKeyHex,
                    walletStateInit: stateInitBase64,
                  },
                  ...(tonProofItem ? [tonProofItem] : []),
                ],
                device: {
                  platform: "browser",
                  appName: "Tonkeeper",
                  appVersion: "1.0.0",
                  maxProtocolVersion: 2,
                  features: ["SendTransaction"],
                },
              },
            };

            setTimeout(() => {
              listeners.forEach((listener) => listener(connectSuccessEvent));
            }, 50);

            return connectSuccessEvent;
          },

          restoreConnection: async () => {
            return {
              event: "connect",
              id: Date.now(),
              payload: {
                items: [
                  {
                    name: "ton_addr",
                    address: rawAddress,
                    network: network,
                    publicKey: publicKeyHex,
                    walletStateInit: stateInitBase64,
                  },
                ],
                device: {
                  platform: "browser",
                  appName: "Tonkeeper",
                  appVersion: "1.0.0",
                  maxProtocolVersion: 2,
                  features: ["SendTransaction"],
                },
              },
            };
          },

          disconnect: async () => {
            const disconnectEvent = {
              event: "disconnect",
              payload: {},
            };
            listeners.forEach((listener) => listener(disconnectEvent));
          },

          send: async (request: any) => {
            if (request.method === "sendTransaction") {
              return {
                result: "te6cckEBAQEAAgAAAEysuc0=", // Mock BOC response
              };
            }
            throw new Error(`Unsupported method: ${request.method}`);
          },

          listen: (callback: (event: any) => void) => {
            listeners.push(callback);
            return () => {
              const idx = listeners.indexOf(callback);
              if (idx > -1) listeners.splice(idx, 1);
            };
          },
        },
      };

      console.log("✅ Headless Tonkeeper Injected:", rawAddress);
    },
    {
      rawAddress,
      publicKeyHex,
      stateInitBase64,
      domain,
      network,
      secretKeyHex,
    }
  );

  return {
    rawAddress,
    userFriendlyAddress,
    publicKeyHex,
    secretKeyHex,
    stateInitBase64,
  };
}
