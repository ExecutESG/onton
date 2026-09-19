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
          <div className="mt-auto flex flex-wrap items-center gap-3 text-xs text-gray-500">
            {footerTexts.map((text, index) => (
              <div
                key={index}
                className={cn("flex items-center gap-1", text.variant === "error" ? "text-red-500" : "")}
              >
                {text.count !== undefined && <span className="font-semibold text-gray-800 dark:text-gray-200">{text.count}</span>}
                <span>{text.items}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="self-center">
          <ArrowRight className="text-main-button-color" />
        </div>
      </div>
    </Card>
  );
}
