"use client";

import CustomButton from "@/app/_components/Button/CustomButton";
import { Address, beginCell, toNano } from "@ton/core";
import { useTonConnectUI } from "@tonconnect/ui-react";

const body = beginCell()
  .storeUint(0x5fcc3d14, 32) // NFT transfer op code 0x5fcc3d14
  .storeUint(0, 64) // query_id:uint64
  .storeAddress(Address.parse("UQDtN69jR1CmFvL21_VBLa9aCNE0iOgC8uHe-9M4iVWb6Wb2")) // new_owner:MsgAddress
  .storeAddress(Address.parse("UQDtN69jR1CmFvL21_VBLa9aCNE0iOgC8uHe-9M4iVWb6Wb2")) // response_destination:MsgAddress
  .storeUint(0, 1) // custom_payload:(Maybe ^Cell)
  .storeCoins(1) // forward_amount:(VarUInteger 16) (1 nanoTon = toNano("0.000000001"))
  .storeUint(0, 1) // forward_payload:(Either Cell ^Cell)
  .endCell();

export const MergeNftsButton = () => {
  const [tonconnectUI] = useTonConnectUI();

  const mergeThreeNFTs = () => {
    tonconnectUI.sendTransaction({
      messages: [
        {
          address: "0:920102d127014663e78d4955665e2dd46d8742b264767320acf8133f9bd30941",
          amount: toNano("0.05").toString(), // for commission fees, excess will be returned
          payload: body.toBoc().toString("base64"),
        },
        {
          address: "0:09db09b50624693c127b2f78a340e05306da15ec50ce0381e809abe4fae2d43a",
          amount: toNano("0.05").toString(), // for commission fees, excess will be returned
          payload: body.toBoc().toString("base64"),
        },
        {
          address: "0:a169ccd9be5f2b303b8895da496c7a4db671254adfc631d3e98c63e64bbf82b5",
          amount: toNano("0.05").toString(), // for commission fees, excess will be returned
          payload: body.toBoc().toString("base64"),
        },
      ],
      validUntil: Math.floor(Date.now() / 1000 + 60 * 30), // 30min
    });
  };

  return (
    <CustomButton
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        mergeThreeNFTs();
      }}
    >
      Merge NFTS
    </CustomButton>
  );
};
