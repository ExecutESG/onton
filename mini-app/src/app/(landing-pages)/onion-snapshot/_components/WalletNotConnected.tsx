import { setJwt, trpc } from "@/app/_trpc/client";
import Typography from "@/components/Typography";
import { Button } from "@/components/ui/button";
import { PROOF_PAYLOAD_TTL_MS, TON_PROOF_STORAGE_KEY, WalletNetCHAIN_MAP } from "@/constants";
import { TonProofSavedSession } from "@/types";
import {
  TonProofItemReplySuccess,
  useIsConnectionRestored,
  useTonConnectModal,
  useTonConnectUI,
  useTonWallet,
} from "@tonconnect/ui-react";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import DataStatus from "../../../_components/molecules/alerts/DataStatus";

interface WalletNotConnectedProps {
  children: React.ReactNode;
  /** Controls whether to show wallet provider when wallet is disconnected */
  openOnDisconnect?: boolean;
  /** Updates the wallet provider visibility state when disconnected */
  setOpenOnDiconnect?: (open: boolean) => void;
  /** Callback when proof is verified */
  onProofVerified?: (proof: string) => void;
}

const ProofContext = createContext<{ proof: string | null }>({
  proof: null,
});

export const useWalletNotConnectedProofContext = () => {
  return useContext(ProofContext);
};

const WalletNotConnected: React.FC<WalletNotConnectedProps> = ({
  children,
  openOnDisconnect,
  setOpenOnDiconnect,
  onProofVerified,
}) => {
  const tonConnectModal = useTonConnectModal();
  const tonConnectAddress = useTonWallet();
  const wallet = tonConnectAddress?.account.address;

  /* Ton Connect */
  const [ui] = useTonConnectUI();
  const ready = useIsConnectionRestored();

  /* tRPC */
  const genPayload = trpc.tonProof.generatePayload.useQuery(undefined, { enabled: false });
  const verify = trpc.tonProof.verifyProof.useMutation();

  /* local state */
  const [proof, setProof] = useState<string>(); // stringified proof
  const [jwtOk, setJwtOk] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (tonConnectAddress?.account.address) {
      setOpenOnDiconnect?.(false);
    }
    if (!ready) return; // TonConnect hasn’t finished restoring
    if (wallet) return; // a wallet *is* connected – keep session
    setJwt("");
    setProof(undefined);
    onProofVerified?.("");
    setJwtOk(true);
    localStorage.removeItem(TON_PROOF_STORAGE_KEY);
  }, [tonConnectAddress?.account.address]);

  /* ----------------------------------------------------------------
     STEP 0  – payload pre-load (when NO wallet connected)
  ---------------------------------------------------------------- */
  useEffect(() => {
    if (!ready || wallet) return;

    const refresh = async () => {
      ui.setConnectRequestParameters({ state: "loading" });
      try {
        const { data } = await genPayload.refetch();
        if (!data?.payload) throw new Error();
        ui.setConnectRequestParameters({ state: "ready", value: { tonProof: data.payload } });
      } catch {
        ui.setConnectRequestParameters(null);
      }
    };

    refresh();
    clearInterval(timerRef.current);
    timerRef.current = setInterval(refresh, PROOF_PAYLOAD_TTL_MS);
    return () => clearInterval(timerRef.current);
  }, [ready, wallet, genPayload, ui]);

  /* ----------------------------------------------------------------
     STEP 1  – wallet connected / restored
  ---------------------------------------------------------------- */
  useEffect(() => {
    const checkLocalStorage = async () => {
      if (!ready || !wallet || verify.isLoading || proof) return;

      /* a) try localStorage first */
      const saved = localStorage.getItem(TON_PROOF_STORAGE_KEY);
      if (saved) {
        const { token, proof } = JSON.parse(saved) as TonProofSavedSession;
        setJwt(token);
        setProof(proof);
        setJwtOk(true);
        onProofVerified?.(proof);
        return;
      }

      /* b) need to verify fresh proof */
      const reply = tonConnectAddress.connectItems?.tonProof;
      if (reply && !("error" in reply)) {
        const prf = (reply as TonProofItemReplySuccess).proof;
        try {
          const { token } = await verify.mutateAsync({
            address: tonConnectAddress.account.address,
            network: WalletNetCHAIN_MAP[tonConnectAddress.account.chain] ?? "-239",
            public_key: tonConnectAddress.account.publicKey ?? "",
            proof: { ...prf, address: tonConnectAddress.account.address, state_init: "" },
          });

          const session: TonProofSavedSession = { token, proof: JSON.stringify(prf) };

          setJwt(token);
          setJwtOk(true);
          setProof(session.proof);
          localStorage.setItem(TON_PROOF_STORAGE_KEY, JSON.stringify(session));
          onProofVerified?.(session.proof);
        } catch {
          toast.error("Proof invalid – reconnect.");
          ui.disconnect();
        }
      } else {
        toast.error("Proof missing – reconnect.");
        ui.disconnect();
      }
    };
    checkLocalStorage();
  }, [ready, wallet, verify, ui]);

  /* ---------------------------------------------------------------- */
  if (
    (jwtOk &&
      // If the user has a connected wallet, show the children
      tonConnectAddress?.account.address &&
      proof) || // OR
    // if wallet was not connect but the state on disconnect was open we show the children
    (!tonConnectAddress?.account.address && !openOnDisconnect)
  ) {
    return <ProofContext.Provider value={{ proof: proof ?? null }}>{children}</ProofContext.Provider>;
  }

  // Otherwise show the connect wallet UI
  return (
    <div className="px-8 py-10 flex flex-col items-center w-full mx-auto gap-6">
      <DataStatus
        status="not_found"
        size="lg"
      />
      <div className="flex flex-col gap-4">
        <Typography
          variant="title1"
          weight="bold"
          className="text-center text-zinc-900"
        >
          Connect Wallet
        </Typography>
        <div className="flex flex-col gap-2">
          <Typography
            variant="subheadline2"
            className="text-center font-bold"
          >
            To check your ONIONs, connect your TON tonConnectAddress.
          </Typography>
          <Typography
            variant="footnote"
            className="text-center font-normal"
          >
            This doesn&apos;t cost gas or give us access to your funds.
          </Typography>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            tonConnectModal.open();
          }}
          isLoading={genPayload.isLoading || verify.isLoading}
        >
          Connect Wallet
        </Button>
        <Typography
          variant="footnote"
          className="text-center"
        >
          The wallet address must be associated with a single unique TID. Once linked, you cannot unlink it or connect this
          wallet to a different TID.
        </Typography>
      </div>
    </div>
  );
};

export default WalletNotConnected;
