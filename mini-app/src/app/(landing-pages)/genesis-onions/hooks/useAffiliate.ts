import { trpc } from "@/app/_trpc/client";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { AFFILIATE_HASH_LOCAL_KEY, AFFILIATE_HASH_SEARCH_PARAM_KEY } from "../GenesisOnions.constants";
import { useLocalStorage } from "@mantine/hooks";

export const useAffiliate = () => {
    const searchParams = useSearchParams();
    const affiliateHashQueryParam = searchParams.get(AFFILIATE_HASH_SEARCH_PARAM_KEY)?.trim();

    const [affiliateHash, setAffiliateHash] = useLocalStorage<string | null>({
        key: AFFILIATE_HASH_LOCAL_KEY,
    });

    useEffect(() => {
        if (!!affiliateHashQueryParam && affiliateHashQueryParam !== affiliateHash) {
            setAffiliateHash(affiliateHashQueryParam);
        }
    }, [affiliateHashQueryParam, affiliateHash, setAffiliateHash]);

    const {
        mutateAsync: inviteAsync,
        isLoading,
        isError,
    } = trpc.telegramInteractions.requestShareAffiliateOnionCampaign.useMutation();

    const inviteOnTelegram = useCallback(async () => {
        try {
            await inviteAsync();
            if (window.Telegram?.WebApp?.close) {
                window.Telegram?.WebApp?.close();
            }
        } catch (error) {
            console.error("inviteOnTelegram error:", error);
            throw new Error("Unable to open the invitation dialogue, please try again later.");
        }
    }, [inviteAsync]);

    const resetAffiliateHash = () => setAffiliateHash(null);

    return {
        inviteOnTelegram,
        isLoading,
        isError,
        affiliateHash,
        resetAffiliateHash,
        inviteAsync
    };
};
