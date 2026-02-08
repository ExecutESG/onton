"use client";
import { Checkbox } from "@/components/ui/checkbox";
import { KSheet } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Block, BlockTitle, Button } from "konsta/react";
import React, { useEffect, useState } from "react";

interface Hub {
  id: string;
  name: string;
}

interface HubSelectorDrawerProps {
  isOpen: boolean;
  onOpenChange: (_open: boolean) => void;
  selectedHubs: string[];
  setSelectedHubs: (_hubs: string[]) => void;
  hubs: Hub[];
}

const HubSelectorDrawer: React.FC<HubSelectorDrawerProps> = ({
  isOpen,
  onOpenChange,
  selectedHubs,
  setSelectedHubs,
  hubs,
}) => {
  const [localSelectedHubs, setLocalSelectedHubs] = useState<string[]>([]);

  useEffect(() => {
    console.log({
      isOpen,
    });

    if (isOpen) {
      setLocalSelectedHubs([...selectedHubs]);
    }
  }, [isOpen, selectedHubs]);

  const toggleHubSelection = (hubId: string) => {
    setLocalSelectedHubs((prev) => (prev.includes(hubId) ? prev.filter((id) => id !== hubId) : [...prev, hubId]));
  };

  const selectAllHubs = () => {
    setLocalSelectedHubs(hubs.map((hub) => hub.id));
  };

  const deselectAllHubs = () => {
    setLocalSelectedHubs([]);
  };

  const handleDoneClick = () => {
    setSelectedHubs(localSelectedHubs);
    onOpenChange(false);
  };

  const allSelected = localSelectedHubs.length === hubs.length;

  return (
    <KSheet
      hideTrigger
      dontHandleMainButton
      open={isOpen}
      onOpenChange={onOpenChange}
    >
      <BlockTitle>Select Hubs</BlockTitle>

      <Block className="my-0 space-y-2">
        <div
          className="flex justify-between items-center cursor-pointer p-0 px-10"
          onClick={(e) => {
            e.preventDefault();
            allSelected ? deselectAllHubs : selectAllHubs;
          }}
        >
          <span className="text-zinc-400">Select All</span>
          <Checkbox
            checked={allSelected}
            onCheckedChange={allSelected ? deselectAllHubs : selectAllHubs}
            className="h-5 w-5"
          />
        </div>
        <Separator className="my-2" />
        <ScrollArea className="h-[50vh] w-full rounded-md border-0 p-4 py-0">
          {hubs.map((hub) => (
            <div
              key={hub.id}
              className={`flex justify-between items-center border-b-2 border-b-gray-800 px-6 cursor-pointer h-12`}
              onClick={(e) => {
                e.preventDefault();
                toggleHubSelection(hub.id);
              }}
            >
              <span>{hub.name}</span>
              <Checkbox
                checked={localSelectedHubs.includes(hub.id)}
                className="h-6 w-6"
              />
            </div>
          ))}
        </ScrollArea>
        <Button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDoneClick();
          }}
        >
          Done
        </Button>
      </Block>
    </KSheet>
  );
};

export default HubSelectorDrawer;
