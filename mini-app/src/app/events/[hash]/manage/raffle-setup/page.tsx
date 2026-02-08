"use client";

import PromotionCode from "@/app/_components/Event/PromotionCode/PromotionCode";
import Typography from "@/components/Typography";
import { Page } from "konsta/react";
import RaffleDefineForm from "@/app/events/[hash]/manage/raffle-setup/RaffleDefineForm";

export default function PromotionCodePage() {
  return (
    <Page className="">
      <RaffleDefineForm />
    </Page>
  );
}
