"use client";

import Typography from "@/components/Typography";
import { List, ListItem, Popover } from "konsta/react";
import { MoreVertical } from "lucide-react";
import { useRef, useState } from "react";
import CustomCard from "../../atoms/cards/CustomCard";
import PromotionCodeIcon from "../../icons/promotion-code-icon";

interface FooterText {
  count?: number;
  value: string;
}

interface MenuItem {
  label: string;
  onClick: () => void;
  color?: string;
}

interface ActionCardWithMenuProps {
  title: string;
  subtitle: string;
  footerTexts: FooterText[];
  menuItems: MenuItem[];
  onCardClick?: () => void;
}

export default function ActionCardWithMenu({
  title,
  subtitle,
  footerTexts,
  menuItems,
  onCardClick,
}: ActionCardWithMenuProps) {
  // local state for popover
  const [popoverOpened, setPopoverOpened] = useState(false);
  const threeDotRef = useRef<HTMLDivElement>(null);

  const handleMenuClick = () => {
    setPopoverOpened(!popoverOpened);
  };

  const closeMenu = () => {
    setPopoverOpened(false);
  };

  return (
    <CustomCard
      onClick={(e) => {
        onCardClick?.();
      }}
      className="cursor-pointer"
      defaultPadding
    >
      <div className="flex gap-3 align-stretch">
        <div className="bg-[#efeff4] p-4 rounded-[10px]">
          <PromotionCodeIcon className="text-primary" />
        </div>
        <div className="flex flex-col flex-1 gap-1">
          <Typography
            bold
            variant="title3"
          >
            {title}
          </Typography>
          <Typography variant="body">{subtitle}</Typography>
          <Typography
            variant="caption1"
            className="mt-auto flex gap-4"
          >
            {footerTexts.map((text, index) => (
              <div key={index}>
                {(text.count || text.count === 0) && <b>{text.count} </b>}
                {text.value}
              </div>
            ))}
          </Typography>
        </div>

        {/* 3-dot menu on the right */}
        <div
          ref={threeDotRef}
          className="self-center p-2"
          onClick={(e) => {
            e.stopPropagation(); // don't trigger card onClick
            handleMenuClick();
          }}
        >
          <MoreVertical className="text-main-button-color" />
        </div>
      </div>

      {/* Popover for the menu */}
      <Popover
        opened={popoverOpened}
        onBackdropClick={closeMenu}
        target={threeDotRef}
        className="w-[160px]"
      >
        <List
          strongIos
          outlineIos
        >
          {menuItems.map((item, i) => (
            <ListItem
              key={i}
              link
              title={item.label}
              className={item.color || ""}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                closeMenu();
                item.onClick();
              }}
            />
          ))}
        </List>
      </Popover>
    </CustomCard>
  );
}
