import { Address } from "@ton/core";
import { JettonMaster, JettonWallet } from "@ton/ton";
import { getJettonWallet, v2_client } from "@/services/tonCenter";
import { logger } from "@/server/utils/logger";

export type JettonBalanceProbe = {
  balance: bigint;
  walletAddress: string;
};

export async function fetchJettonBalance(ownerAddress: string, masterAddress: string): Promise<JettonBalanceProbe | null> {
  try {
    const owner = Address.parse(ownerAddress);
    const master = Address.parse(masterAddress);
    const ownerFriendly = owner.toString({ bounceable: true, urlSafe: true });
    const ownerRaw = owner.toRawString();
    const masterFriendly = master.toString({ bounceable: true, urlSafe: true });
    const masterRaw = master.toRawString();

    const client = v2_client();
    logger.log(`[JettonBalance] probe`, {
      owner: ownerFriendly,
      ownerRaw,
      master: masterFriendly,
      masterRaw,
    });

    const masterContract = client.open(JettonMaster.create(master));
    const walletAddress = await masterContract.getWalletAddress(owner);
    const walletAddressFriendly = walletAddress.toString({ bounceable: true, urlSafe: true });
    logger.log(`[JettonBalance] derived wallet`, walletAddressFriendly);

    try {
      const wallet = client.open(JettonWallet.create(walletAddress));
      const balance = await wallet.getBalance();
      logger.log(`[JettonBalance] balance fetched`, balance.toString());
      return {
        balance,
        walletAddress: walletAddressFriendly,
      };
    } catch (err) {
      logger.warn(`[JettonBalance] on-chain read failed, falling back`, err);
      const firstPass = await getJettonWallet(ownerRaw, { jettonAddress: masterRaw, limit: 100 });
      let wallets: Array<{ address: string; balance: string; jetton: string }> = firstPass?.jetton_wallets ?? [];
      if (!wallets.length) {
        logger.log(`[JettonBalance] fallback retry friendly`, { ownerFriendly, masterFriendly });
        const secondPass = await getJettonWallet(ownerFriendly, { jettonAddress: masterFriendly, limit: 100 });
        wallets = secondPass?.jetton_wallets ?? [];
      }
      const row = wallets.find((w) => {
        if (!w.jetton) return false;
        if (w.jetton === masterFriendly) return true;
        try {
          return Address.parse(w.jetton).toString({ bounceable: true, urlSafe: true }) === masterFriendly;
        } catch {
          return false;
        }
      });
      if (!row) {
        logger.log(`[JettonBalance] fallback missing wallet`, { masterFriendly, masterRaw, wallets });
        return null;
      }
      const balance = BigInt(row.balance ?? "0");
      logger.log(`[JettonBalance] fallback balance`, balance.toString());
      return {
        balance,
        walletAddress: row.address ?? walletAddressFriendly,
      };
    }
  } catch (error) {
    logger.warn(`[JettonBalance] Failed to fetch jetton balance for ${ownerAddress} @ ${masterAddress}`, error);
    return null;
  }
}
