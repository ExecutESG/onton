"use client";

// import { trpc } from "@/app/_trpc/client";
// import Typography from "@/components/Typography";
// import { Button } from "@/components/ui/button";
// import { useConfig } from "@/context/ConfigContext";
// import useWebApp from "@/hooks/useWebApp";
// import { cn } from "@/lib/utils";
// import { CampaignNFT } from "@/types/campaign.types";
// import { Address, beginCell, toNano } from "@ton/core";
// import { toUserFriendlyAddress, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
// import { Loader2 } from "lucide-react";
// import Image from "next/image";
// import { useState } from "react";
// import { FaChevronRight } from "react-icons/fa6";
// import { toast } from "sonner";
// import "./_assets/genesis-onions.css";
// import { Header } from "./_components/Header";
// import { COLORS, getFilterUrl, getImageUrl } from "./_components/Merge/constants";
// import { DescriptionSection } from "./_components/Merge/DescriptionSection";
// import { MergeTransactionsList } from "./_components/Merge/MergeTransactionList";
// import { NFTCard } from "./_components/Merge/NFTCard";
// import { customToast } from "./GenesisOnions.utils";

export default function GenesisOnions() {
  return null;
  // const [hasPendingTx, setHasPendingTx] = useState<boolean | null>(null);

  // const webapp = useWebApp();
  // const config = useConfig();
  // const walletAddress = useTonWallet();

  // const [tonConnectUI] = useTonConnectUI();

  // const addMergeTxMutation = trpc.campaign.addMergeTransaction.useMutation({
  //   onError(error) {
  //     customToast.error(error.message);
  //   },
  // });

  // const walletInfo = trpc.campaign.getWalletInfo.useQuery(
  //   { walletAddress: walletAddress?.account.address as string },
  //   {
  //     enabled: Boolean(walletAddress?.account.address),
  //     queryKey: ["campaign.getWalletInfo", { walletAddress: walletAddress?.account.address as string }],
  //   }
  // );

  // const [goldAbleArr, silverAbleArr, bronzeAbleArr] = ["1", "2", "3"].map((type) =>
  //   (walletInfo.data?.itemsByType[type] || []).filter((item) => item.offChain.mergeStatus === "able_to_merge")
  // );

  // const nfts = {
  //   gold: goldAbleArr,
  //   silver: silverAbleArr,
  //   bronze: bronzeAbleArr,
  // };

  // const isAbleToMerge = Boolean(goldAbleArr.length && silverAbleArr.length && bronzeAbleArr.length);

  // const ontonAddress = config["ONTON_MINTER_WALLET"] as string;

  // /**
  //  * Called when user clicks "Merge one set now"
  //  * 1) Insert row => addMergeTransaction (status="pending")
  //  * 2) Then build TonConnect multi-message
  //  * 3) Send transaction
  //  * 4) Cron job sees the chain TX => sets "completed"
  //  */
  // async function handleMergeNfts() {
  //   const address = walletAddress?.account.address;
  //   if (!isAbleToMerge || !address) {
  //     toast.error("No full set (gold/silver/bronze) to merge.");
  //     return;
  //   }

  //   const goldNft = goldAbleArr[0] as CampaignNFT;
  //   const silverNft = silverAbleArr[0] as CampaignNFT;
  //   const bronzeNft = bronzeAbleArr[0] as CampaignNFT;

  //   try {
  //     // (A) Insert "pending" row in DB
  //     await addMergeTxMutation.mutateAsync({
  //       walletAddress: address,
  //       goldNftAddress: goldNft.onChain?.address as string,
  //       silverNftAddress: silverNft.onChain?.address as string,
  //       bronzeNftAddress: bronzeNft.onChain?.address as string,
  //     });

  //     // (B) Then build multi-message
  //     const messages = [
  //       createNftTransferMsg(goldNft),
  //       createNftTransferMsg(silverNft),
  //       createNftTransferMsg(bronzeNft),
  //       createMergeFlagMessage(
  //         `user=${toUserFriendlyAddress(walletAddress.account.address)}&indexes=[${goldNft.onChain?.index},${silverNft.onChain?.index},${bronzeNft.onChain?.index}]`
  //       ),
  //     ];

  //     // (C) TonConnect transaction
  //     await tonConnectUI.sendTransaction({
  //       validUntil: Math.floor(Date.now() / 1000) + 600,
  //       messages,
  //     });

  //     setTimeout(
  //       () => {
  //         void walletInfo.refetch(); // re-check user items
  //       },
  //       1000 * 60 * 3
  //     );
  //     toast.success("NFTs merge transaction submitted!");
  //   } catch (err) {
  //     console.error("Merge transaction error:", err);
  //     toast.error("Failed to merge NFTs or user canceled.");
  //   }
  // }

  // function createNftTransferMsg(nft: CampaignNFT) {
  //   const nftAddr = Address.parse(nft.onChain?.address as string);

  //   const bodyCell = beginCell()
  //     .storeUint(0x5fcc3d14, 32)
  //     .storeUint(0, 64)
  //     .storeAddress(Address.parse(ontonAddress))
  //     .storeAddress(null)
  //     .storeBit(true)
  //     .storeRef(
  //       beginCell().storeStringTail(`Name: ${nft.collectionInfo.name}\nImage: ${nft.collectionInfo.image}`).endCell()
  //     )
  //     .storeCoins(0)
  //     .storeBit(false)
  //     .endCell();

  //   return {
  //     address: nftAddr.toString(),
  //     amount: toNano("0.05").toString(),
  //     payload: bodyCell.toBoc().toString("base64"),
  //   };
  // }

  // function createMergeFlagMessage(flagComment: string) {
  //   const bodyCell = beginCell().storeUint(0, 32).storeStringTail(flagComment).endCell();

  //   return {
  //     address: ontonAddress,
  //     amount: toNano("0.005").toString(),
  //     payload: bodyCell.toBoc().toString("base64"),
  //   };
  // }

  // function handleMainButtonClick(e: React.MouseEvent<HTMLButtonElement>): void {
  //   e.preventDefault();
  //   e.stopPropagation();

  //   if (!walletAddress) {
  //     return;
  //   }

  //   if (isAbleToMerge) {
  //     void handleMergeNfts();
  //   } else {
  //     // redirect to getgems
  //     void webapp?.openLink("https://getgems.io/genesisonions");
  //   }
  // }

  // return (
  //   <div>
  //     <Header />
  //     <main
  //       className="bg-navy text-white min-h-screen p-4 flex flex-col gap-5"
  //       style={{
  //         background: "radial-gradient(69.74% 28.27% at 50% 33.25%, #31517B 0%, #0A1C33 100%)",
  //       }}
  //     >
  //       {/* SBT Cards */}
  //       <div className="flex gap-4">
  //         {COLORS.map((color) => (
  //           <button
  //             key={color}
  //             onClick={() => webapp?.openLink(getFilterUrl(color))}
  //             className="border border-white p-2 flex flex-col gap-0.5 justify-center items-center bg-white/10 rounded-md backdrop-blur-lg w-full"
  //           >
  //             <Image
  //               width={40}
  //               height={40}
  //               src={getImageUrl(color)}
  //               alt={`${color} NFT`}
  //               className="rounded-md aspect-square"
  //             />
  //             <Typography
  //               variant="body"
  //               weight="medium"
  //               className="flex items-center gap-2 justify-center capitalize"
  //             >
  //               {color} <FaChevronRight size={12} />
  //             </Typography>
  //           </button>
  //         ))}
  //       </div>

  //       {/* Main Cards (Merge) */}
  //       <div className="p-4 backdrop-blur-lg bg-white/10 rounded-md flex-col flex gap-3 items-center justify-center">
  //         <Typography
  //           variant="headline"
  //           weight="semibold"
  //           className="text-center"
  //         >
  //           When ONIONs come to life
  //         </Typography>
  //         <Typography
  //           variant="subheadline1"
  //           weight="normal"
  //           className="text-center"
  //         >
  //           Tap on &ldquo;Merge to Platinum&rdquo; to burn a set of Gold, Silver and Bronze and Receive a new Platinum NFT!
  //         </Typography>

  //         {/* SBT Counts */}
  //         <div className="flex flex-col gap-1 w-full">
  //           <div className="flex flex-1 gap-4 w-full">
  //             {COLORS.map((color) => (
  //               <NFTCard
  //                 key={color}
  //                 color={color}
  //                 nftList={nfts[color] ?? []}
  //                 isLoading={Boolean(walletInfo.isLoading && walletAddress)}
  //               />
  //             ))}
  //           </div>
  //           {isAbleToMerge && <p className="text-[8px] leading-4 text-center">You have enough NFTs to Merge a Platinum</p>}
  //         </div>

  //         {/* Merge Preview */}
  //         <MergeTransactionsList setHasPendingTrx={setHasPendingTx} />

  //         <div className="flex justify-center items-center">
  //           <span className="text-white text-2xl font-semibold">=</span>
  //         </div>
  //         <div className="relative rounded-lg overflow-hidden">
  //           <Image
  //             width={100}
  //             height={100}
  //             src={getImageUrl("Platinum")}
  //             priority={true}
  //             alt="Platinum NFT"
  //             className={cn(
  //               "rounded-md aspect-square",
  //               !walletAddress && walletInfo.data?.platinumCount === 0 && "grayscale"
  //             )}
  //           />
  //           <div className="absolute bottom-0 flex h-7.5 items-center gap-2 backdrop-blur-md bg-white/10 w-full justify-center text-center">
  //             <Typography className="!text-[8px] text-[#cbcbcb]">Platinum</Typography>
  //             <Typography
  //               variant="title3"
  //               weight="semibold"
  //             >
  //               x{walletAddress ? (walletInfo.data?.platinumCount ?? "?") : null}
  //             </Typography>
  //           </div>
  //         </div>

  //         <Button
  //           type="button"
  //           disabled={!walletAddress || walletInfo.isLoading || addMergeTxMutation.isLoading || Boolean(hasPendingTx)}
  //           variant="primary-onion"
  //           className={cn(
  //             "w-full px-8 py-3 rounded-lg  isolate",
  //             walletAddress &&
  //               walletInfo.isSuccess &&
  //               Boolean(!hasPendingTx) &&
  //               "btn-gradient btn-shine transition-all transform hover:animate-none after:bottom-0 before:top-0 relative overflow-hidden"
  //           )}
  //           onClick={handleMainButtonClick}
  //           size="lg"
  //         >
  //           <Typography
  //             variant="headline"
  //             weight="semibold"
  //           >
  //             {hasPendingTx ? (
  //               <div className="flex items-center justify-center gap-1">
  //                 <span>Processing Transaction</span>
  //                 <Loader2 className="animate-spin" />
  //               </div>
  //             ) : isAbleToMerge ? (
  //               "Merge to Platinum"
  //             ) : (
  //               "Collect Sufficient ONIONs"
  //             )}
  //           </Typography>
  //         </Button>
  //       </div>

  //       {/* Description Card */}
  //       <DescriptionSection />
  //     </main>
  //   </div>
  //);
}
