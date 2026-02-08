"use client";

import MergeTransactionsList from "@/app/(navigation)/sample/MergeTransactionsList";
import { trpc } from "@/app/_trpc/client";
import { Address, beginCell, toNano } from "@ton/ton";
import { useTonConnectUI } from "@tonconnect/ui-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const ONTON_WALLET_ADDRESS = Address.parse("UQDMJeQqQSW7tmt-aspG9BNEMCj9RiENnwTSx0L-62Sjr9Te");

interface MergeNftsFlowProps {
  walletAddress: string; // The user’s wallet address
}

export function MergeNftsFlow({ walletAddress }: MergeNftsFlowProps) {
  const [tonConnectUI] = useTonConnectUI();

  // 1) Query user’s wallet info (gold/silver/bronze)
  const { data, isLoading, refetch } = trpc.campaign.getWalletInfo.useQuery({ walletAddress }, { enabled: !!walletAddress });

  const [goldNft, setGoldNft] = useState<any | null>(null);
  const [silverNft, setSilverNft] = useState<any | null>(null);
  const [bronzeNft, setBronzeNft] = useState<any | null>(null);

  const [totalGold, setTotalGold] = useState<number>(0);
  const [totalSilver, setTotalSilver] = useState<number>(0);
  const [totalBronze, setTotalBronze] = useState<number>(0);
  const [mergeableSets, setMergeableSets] = useState<number>(0);

  // 2) Here we define a tRPC mutation for addMergeTransaction
  const addMergeTxMutation = trpc.campaign.addMergeTransaction.useMutation();

  useEffect(() => {
    if (!data?.itemsByType) return;

    const goldArr = data.itemsByType["1"] || [];
    const silverArr = data.itemsByType["2"] || [];
    const bronzeArr = data.itemsByType["3"] || [];

    setTotalGold(goldArr.length);
    setTotalSilver(silverArr.length);
    setTotalBronze(bronzeArr.length);

    const goldAbleArr = goldArr.filter((item: any) => item.offChain.mergeStatus === "able_to_merge");
    const silverAbleArr = silverArr.filter((item: any) => item.offChain.mergeStatus === "able_to_merge");
    const bronzeAbleArr = bronzeArr.filter((item: any) => item.offChain.mergeStatus === "able_to_merge");

    const possibleSets = Math.min(goldAbleArr.length, silverAbleArr.length, bronzeAbleArr.length);
    setMergeableSets(possibleSets);

    setGoldNft(goldAbleArr[0] || null);
    setSilverNft(silverAbleArr[0] || null);
    setBronzeNft(bronzeAbleArr[0] || null);
  }, [data]);

  const hasAllThree = goldNft && silverNft && bronzeNft;

  /**
   * Called when user clicks "Merge one set now"
   * 1) Insert row => addMergeTransaction (status="pending")
   * 2) Then build TonConnect multi-message
   * 3) Send transaction
   * 4) Cron job sees the chain TX => sets "completed"
   */
  async function handleMergeNfts() {
    if (!hasAllThree) {
      toast.error("No full set (gold/silver/bronze) to merge.");
      return;
    }

    try {
      // (A) Insert "pending" row in DB
      const newTx = await addMergeTxMutation.mutateAsync({
        walletAddress,
        goldNftAddress: goldNft.onChain.address,
        silverNftAddress: silverNft.onChain.address,
        bronzeNftAddress: bronzeNft.onChain.address,
      });
      toast.success(`Created mergeTx #${newTx.id}, status=${newTx.status}`);

      // (B) Then build multi-message
      const messages = [
        createNftTransferMsg(goldNft),
        createNftTransferMsg(silverNft),
        createNftTransferMsg(bronzeNft),
        createMergeFlagMessage(
          `user=${walletAddress}&indexes=[${goldNft.onChain.index},${silverNft.onChain.index},${bronzeNft.onChain.index}]`
        ),
      ];

      // (C) TonConnect transaction
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages,
      });
      toast.success("NFTs merge transaction submitted!");
      await refetch(); // re-check user items
    } catch (err) {
      console.error("Merge transaction error:", err);
      toast.error("Failed to merge NFTs or user canceled.");
    }
  }

  function createNftTransferMsg(nft: any) {
    const nftAddr = Address.parse(nft.onChain.address);

    const bodyCell = beginCell()
      .storeUint(0x5fcc3d14, 32)
      .storeUint(0, 64)
      .storeAddress(ONTON_WALLET_ADDRESS)
      .storeAddress(null)
      .storeBit(true)
      .storeRef(
        beginCell().storeStringTail(`Name: ${nft.collectionInfo.name}\nImage: ${nft.collectionInfo.image}`).endCell()
      )
      .storeCoins(0)
      .storeBit(false)
      .endCell();

    return {
      address: nftAddr.toString(),
      amount: toNano("0.05").toString(),
      payload: bodyCell.toBoc().toString("base64"),
    };
  }

  function createMergeFlagMessage(flagComment: string) {
    const bodyCell = beginCell().storeUint(0, 32).storeStringTail(flagComment).endCell();

    return {
      address: ONTON_WALLET_ADDRESS.toString(),
      amount: toNano("0.001").toString(),
      payload: bodyCell.toBoc().toString("base64"),
    };
  }

  if (isLoading) {
    return <div>Loading wallet data…</div>;
  }

  if (!data) {
    return <div>No wallet info found.</div>;
  }

  return (
    <div className="p-4 bg-slate-50 rounded">
      <h2 className="text-xl font-bold mb-2">Merge NFTs</h2>
      <p>Wallet: {walletAddress}</p>
      <p>Balance: {data.balance} TON</p>

      <div className="mt-4 space-y-1">
        <p>Total Gold: {totalGold}</p>
        <p>Total Silver: {totalSilver}</p>
        <p>Total Bronze: {totalBronze}</p>
        <p className="font-medium">Mergeable Sets: {mergeableSets}</p>
      </div>

      <div className="mt-4">
        <p>Gold NFT: {goldNft ? goldNft.onChain.address : "none"}</p>
        <p>Silver NFT: {silverNft ? silverNft.onChain.address : "none"}</p>
        <p>Bronze NFT: {bronzeNft ? bronzeNft.onChain.address : "none"}</p>
      </div>

      <button
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
        disabled={!hasAllThree}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleMergeNfts();
        }}
      >
        {hasAllThree ? "Merge one set now" : "Cannot Merge (need Gold/Silver/Bronze)"}
      </button>
      <div>
        <h1>My Merge Transactions</h1>
        <MergeTransactionsList walletAddress={walletAddress} />
      </div>
    </div>
  );
}
