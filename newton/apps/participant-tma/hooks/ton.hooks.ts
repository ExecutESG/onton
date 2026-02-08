import { Address, beginCell } from "@ton/ton";
import { useTonConnectUI } from "@tonconnect/ui-react";
import { PaymentToken } from "~/types/order.types";
import { toTokenUnits } from "~/utils/common-helper";
import { assetsSdk } from "~/utils/ton.sdk";

interface TransferOptions {
  comment?: string;
}

export function useTransferTon() {
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
  return async (des: string, amount: number, token: PaymentToken, { comment }: TransferOptions) => {
    const destinationAddress = Address.parse(des);

    const isNative = token.is_native ?? token.symbol.toUpperCase() === "TON";

    if (!isNative) {
      if (!token.master_address) {
        throw new Error("Missing master address for jetton transfer");
      }
      const sdk = await assetsSdk(tonConnectUI);
      const sender = sdk.sender;
      if (!sender || !sender.address) {
        throw new Error("Wallet not connected");
      }

      /*
       * PREPARE MESSAGE
       * */
      const forwardPayload = beginCell()
        .storeUint(0, 32) // 0 opcode means we have a comment
        .storeStringTail(comment || "onton transfer")
        .endCell();

      const jetton = sdk.openJetton(Address.parse(token.master_address));
      const myJettonWallet = await jetton.getWallet(sender.address);
      const tokenUnits = toTokenUnits(amount, token.decimals ?? 9);
      await myJettonWallet.send(sender, destinationAddress, tokenUnits, {
        notify: {
          payload: forwardPayload,
        },
      });
      return;
    }

    const body = beginCell()
      .storeUint(0, 32)
      .storeStringTail(comment ?? "onton transfer")
      .endCell()
      .toBoc();

    const tonUnits = toTokenUnits(amount, token.decimals ?? 9);

    await tonConnectUI.sendTransaction({
      validUntil: Math.floor(Date.now() / 1000) + 360,
      messages: [
        {
          address: destinationAddress.toString(),
          amount: tonUnits.toString(),
          payload: body.toString("base64"),
        },
      ],
    });
  };
}
