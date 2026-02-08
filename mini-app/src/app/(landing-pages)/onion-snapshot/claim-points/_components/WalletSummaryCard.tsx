import Typography from "@/components/Typography";
import { AlertGeneric } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { WalletSummary } from "@/db/modules/claimOnion.db";
import { formatWalletAddress } from "@/lib/utils";
import { Address } from "@ton/core";
import { Wallet2Icon } from "lucide-react";
import ClaimPointsModal from "./ClaimPointsModal";

export default function WalletSummaryCard({ wallet }: { wallet: WalletSummary }) {
  return (
    <div className="bg-brand-bg p-2 rounded-2lg gap-2 flex flex-col">
      {/* Wallet */}
      <div className="flex items-center p-2 gap-2">
        <Wallet2Icon
          className="text-info-dark"
          size={16}
        />
        <Typography
          variant="subheadline1"
          weight="normal"
          className="text-info-dark"
        >
          Wallet Address:
        </Typography>
        <Typography
          variant="body"
          weight="medium"
        >
          {formatWalletAddress(Address.parse(wallet.walletAddress).toString({ bounceable: false }))}
        </Typography>
      </div>
      {/* ONION NFTs  */}
      <div className="flex flex-col gap-2 bg-white p-3 rounded-2lg no-scrollbar">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <img
              src="https://storage.onton.live/ontonimage/gem_nft_onions_icon.svg"
              alt="ONION NFTs icon"
              className="w-[24px] h-[24px]"
            />
            <Typography
              variant="subheadline1"
              weight="normal"
            >
              ONION NFTs
            </Typography>
          </div>
          <Typography
            variant="body"
            weight="medium"
          >
            {wallet.nft.totalOnions} ONIONS
          </Typography>
        </div>
        {/* NFT Table */}
        <Table className="min-w-full">
          <TableBody>
            <TableRow className="border-b">
              {Object.keys(wallet.nft.counts).map((tier, index) => (
                <TableCell key={index}>
                  <Typography
                    variant="caption1"
                    weight="normal"
                    className="text-center text-info-dark"
                  >
                    {tier}
                  </Typography>
                </TableCell>
              ))}
            </TableRow>
            <TableRow className="border-b">
              {Object.values(wallet.nft.counts).map((count, index) => (
                <TableCell key={index}>
                  <Typography
                    variant="caption1"
                    weight="normal"
                    className="text-center text-info-dark"
                  >
                    {count}
                  </Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
      {/* ONTON Points */}
      {wallet.scoreOnions > 0 && (
        <>
          <div className="flex flex-col gap-2 bg-white p-3 rounded-2lg">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <img
                  src="https://storage.onton.live/ontonimage/ticket_onions_icon.svg"
                  alt="ONTON Points icon"
                  className="w-[24px] h-[24px]"
                />
                <Typography
                  variant="subheadline1"
                  weight="normal"
                >
                  ONTON Points
                </Typography>
              </div>
              <Typography
                variant="body"
                weight="medium"
              >
                {wallet.scoreOnions} ONIONs
              </Typography>
            </div>
          </div>
        </>
      )}
      {/* Partnership ONIONs */}
      {wallet?.partnershipOnions && wallet.partnershipOnions > 0 && (
        <div className="flex flex-col gap-2 bg-white p-3 rounded-2lg">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <img
                src="https://storage.onton.live/ontonimage/ticket_onions_icon.svg"
                alt="Partnership ONIONs icon"
                className="w-[24px] h-[24px]"
              />
              <Typography
                variant="subheadline1"
                weight="normal"
              >
                Partnership ONIONs
              </Typography>
            </div>
            <Typography
              variant="body"
              weight="medium"
            >
              {wallet.partnershipOnions} ONIONs
            </Typography>
          </div>
        </div>
      )}
      {(wallet.scoreOnions > 0 || (wallet?.partnershipOnions && wallet.partnershipOnions > 0)) && (
        <AlertGeneric variant="info-light">
          Your ONTON points {wallet?.partnershipOnions && wallet.partnershipOnions > 0 ? "and partnership ONIONs " : ""}
          will be used in your first wallet only.
        </AlertGeneric>
      )}
      {/* Total Score */}
      {/* Total ONIONs */}
      {wallet.claimStatus === "not_claimed" && <ClaimPointsModal wallet={wallet} />}
    </div>
  );
}
