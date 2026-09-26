import { Address, beginCell, toNano, Sender, SenderArguments, storeStateInit } from "@ton/ton";
import { TonConnectUI, useTonConnectUI } from "@tonconnect/ui-react";
import { AssetsSDK, createApi } from "@ton-community/assets-sdk";

type TransferType = "USDT" | "TON" | "STAR";

interface TransferOptions {
  comment?: string;
}

/**
 * Sender implementation for TonConnect.
 * This class is used to send messages using the TonConnect UI.
 */
class TonConnectSender implements Sender {
  /**
   * The TonConnect UI instance.
   * @private
   */
  private readonly provider: TonConnectUI;

  /**
   * The address of the current account.
   */
  public get address(): Address | undefined {
    const address = this.provider.account?.address;
    return address ? Address.parse(address) : undefined;
  }

  /**
   * Creates a new TonConnectSender.
   * @param provider
   */
  public constructor(provider: TonConnectUI) {
    this.provider = provider;
  }

  /**
   * Sends a message using the TonConnect UI.
   * @param args
   */
  public async send(args: SenderArguments): Promise<void> {
    // The transaction is valid for 10 minutes.
    const validUntil = Math.floor(Date.now() / 1000) + 600;

    // The address of the recipient, should be in bounceable format for all smart contracts.
    const address = args.to.toString({ urlSafe: true, bounceable: true });

    // The address of the sender, if available.
    const from = this.address?.toRawString();

    // The amount to send in nano tokens.
    const amount = args.value.toString();

    // The state init cell for the contract.
    let stateInit: string | undefined;
    if (args.init) {
      // State init cell for the contract.
      const stateInitCell = beginCell().store(storeStateInit(args.init)).endCell();
      // Convert the state init cell to boc base64.
      stateInit = stateInitCell.toBoc().toString("base64");
    }

    // The payload for the message.
    let payload: string | undefined;
    if (args.body) {
      // Convert the message body to boc base64.
      payload = args.body.toBoc().toString("base64");
    }

    // Send the message using the TonConnect UI and wait for the message to be sent.
    await this.provider.sendTransaction({
      validUntil: validUntil,
      from: from,
      messages: [
        {
          address: address,
          amount: amount,
          stateInit: stateInit,
          payload: payload,
        },
      ],
    });
  }
}

const isTestnet = !(/*NOT*/ ["production", "stage", "staging"].includes(process.env.NEXT_PUBLIC_ENV || "development"));

const NETWORK = isTestnet ? "testnet" : "mainnet";
export const assetsSdk = async (provider: TonConnectUI) => {
  const api = await createApi(NETWORK);
  const sender = new TonConnectSender(provider);

  return AssetsSDK.create({
    api: api,
    sender: sender,
  });
};

export const USDT_MASTER_ADDRESS = Address.parse(
  isTestnet ? "kQD0GKBM8ZbryVk2aESmzfU6b9b_8era_IkvBSELujFZPsyy" : "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs"
);

const calculateUsdtAmount = (usd: number): bigint => BigInt(Math.round(usd * 1_000_000));

export default function useTransferTon() {
  const [tonConnectUI] = useTonConnectUI();

  /**
   * @param des - destination
   *
   * @param amount - amount either in TON or USDT cents
   *
   * @param transferType - USDT or TON
   *
   * @param options - options related to transfer
   */
  return async (des: string, amount: number, transferType: TransferType, { comment }: TransferOptions) => {
    const destinationAddress = Address.parse(des);
    if (transferType === "USDT") {
      /*
       * PREPARE MESSAGE
       * */
      const forwardPayload = beginCell()
        .storeUint(0, 32) // 0 opcode means we have a comment
        .storeStringTail(comment || "onton transfer")
        .endCell();

      const sdk = await assetsSdk(tonConnectUI);

      const jetton = sdk.openJetton(USDT_MASTER_ADDRESS);
      /*
       * TRANSFER
       * */
      const myJettonWallet = await jetton.getWallet(sdk.sender!.address!);
      await myJettonWallet.send(sdk.sender!, destinationAddress, calculateUsdtAmount(amount), {
        notify: {
          payload: forwardPayload,
        },
      });
    } else {
      const body = beginCell()
        .storeUint(0, 32)
        .storeStringTail(comment ?? "onton transfer")
        .endCell()
        .toBoc();

      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 360,
        messages: [
          {
            address: destinationAddress.toString(),
            amount: toNano(amount).toString(),
            payload: body.toString("base64"),
          },
        ],
      });
    }
  };
}
