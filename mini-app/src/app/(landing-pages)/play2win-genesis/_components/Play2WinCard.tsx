import useWebApp from "@/hooks/useWebApp";
import React, { useState } from "react";
import { usePlay2Win } from "./Play2WinContext";
import Play2WinGenesisButton from "./Play2WinGenesisButton";

const Play2WinCard: React.FC = () => {
  const webapp = useWebApp();
  const { nftReserved, contest } = usePlay2Win();
  const [clicked, setClicked] = useState(false);

  const handleClick = () => {
    setClicked(true);
    webapp?.openTelegramLink(contest.gameLink!);
    setTimeout(() => setClicked(false), 2000);
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <Play2WinGenesisButton
        onClick={(e) => {
          e.preventDefault();
          handleClick();
        }}
        disabled={contest.noGame || clicked}
      >
        Play Game
      </Play2WinGenesisButton>
      <p className="text-white text-center">
        <span>{nftReserved} </span>
        <span className="italic">NFTs reserved so far (accumulated)</span>
      </p>
    </div>
  );
};

export default Play2WinCard;
