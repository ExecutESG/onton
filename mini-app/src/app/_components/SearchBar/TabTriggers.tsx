import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs } from "@/components/ui/tabs";
import { Segmented, SegmentedButton } from "konsta/react";
import React from "react";

interface TabItem {
  value: string;
  label: string;
  borderClass?: string;
}

interface TabTriggersProps {
  tabs: TabItem[];
  tabValue: string;
  setTabValue: (_value: string) => void;
  swiperRef: React.MutableRefObject<any>;
}

const TabTriggers: React.FC<TabTriggersProps> = ({ tabs, setTabValue, tabValue = "All", swiperRef }) => {
  const handleTabClick = (value: string, index: number) => {
    setTabValue(value);

    swiperRef.current?.slideTo(index); // Change the slide to match the clicked tab
  };
  return (
    <Tabs
      value={tabValue}
      className="bg-transparent px-0 py-0 "
      onValueChange={(value) => setTabValue(value)}
    >
      <ScrollArea className="w-full whitespace-nowrap border-0 pb-2">
        <Segmented
          rounded
          strong
        >
          {tabs.map((tab, index) => (
            <SegmentedButton
              strong
              // className="!w-auto"
              rounded
              key={tab.value}
              active={tab.value === tabValue}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleTabClick(tab.value, index);
              }}
            >
              {tab.label}
            </SegmentedButton>
          ))}
        </Segmented>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </Tabs>
  );
};

export default TabTriggers;
