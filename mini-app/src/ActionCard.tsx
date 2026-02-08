import { Card } from "konsta/react";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { MouseEventHandler } from "react";
import Typography from "./components/Typography";
import { cn } from "./utils";

interface Props {
  onClick: MouseEventHandler<HTMLElement>;
  iconSrc: string;
  title: string;
  subtitle: string;
  footerTexts: {
    count?: number;
    items: string;
    variant?: "error";
  }[];
}

export default function ActionCard({ onClick, iconSrc, title, subtitle, footerTexts }: Props) {
  return (
    <Card
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick(e);
      }}
      className={cn("!mx-0 w-full ", onClick !== undefined ? "cursor-pointer" : "")}
    >
      <div className="flex gap-3 align-stretch">
        <div className="bg-[#efeff4] p-4 rounded-[10px]">
          <Image
            src={iconSrc}
            width={48}
            height={48}
            alt=""
          />
        </div>
        <div className="flex flex-col flex-1 gap-1">
          <Typography
            className="font-semibold"
            variant="title3"
          >
            {title}
          </Typography>
          <Typography
            variant="body"
            className="font-light"
          >
            {subtitle}
          </Typography>
          <Typography
            variant="caption1"
            className="mt-auto flex gap-4"
          >
            {footerTexts.map((text, index) => (
              <div
                key={index}
                className={text.variant === "error" ? "text-red-500" : ""}
              >
                {text.count !== undefined && <b>{text.count} </b>}
                {text.items}
              </div>
            ))}
          </Typography>
        </div>
        <div className="self-center">
          <ArrowRight className="text-main-button-color" />
        </div>
      </div>
    </Card>
  );
}
