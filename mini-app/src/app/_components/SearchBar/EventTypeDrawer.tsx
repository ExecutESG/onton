"use client";
import { Checkbox } from "@/components/ui/checkbox";
import { KSheet } from "@/components/ui/drawer";
import searchEventsInputZod from "@/zodSchema/searchEventsInputZod";
import { Button } from "konsta/react";
import React, { useEffect, useState } from "react";
import { z } from "zod";

// Extract the participationType from the Zod schema
type SearchEventsInput = z.infer<typeof searchEventsInputZod>;
type ParticipationType = NonNullable<SearchEventsInput["filter"]>["participationType"];

interface EventTypeDrawerProps {
  isOpen: boolean;
  onOpenChange: (_open: boolean) => void;
  participationType: ParticipationType;
  setParticipationTypes: (_types: ParticipationType) => void;
}

const EventTypeDrawer: React.FC<EventTypeDrawerProps> = ({
  isOpen,
  onOpenChange,
  participationType,
  setParticipationTypes,
}) => {
  // Create local state to track the participation type selections
  const [localParticipationType, setLocalParticipationType] = useState<ParticipationType>([]);

  // When the drawer opens, reset the local state to the incoming participationType prop
  useEffect(() => {
    if (isOpen) {
      console.log("Drawer opened. Resetting local state to parent value.");
      setLocalParticipationType([...participationType]); // Spread operator to prevent nested arrays
    }
  }, [isOpen, participationType]);

  // Handle toggling participation type locally
  const handleToggleType = (type: string) => {
    // @ts-expect-error
    setLocalParticipationType((prev) => {
      // @ts-expect-error
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  const handleDoneClick = () => {
    console.log("Applying local participation types:", localParticipationType);
    setParticipationTypes(localParticipationType);
    onOpenChange(false);
  };

  return (
    <KSheet
      hideTrigger
      dontHandleMainButton
      open={isOpen}
      onOpenChange={onOpenChange}
    >
      <div className="p-4 space-y-4">
        <div className="space-y-0">
          {/* Online event row */}
          <div
            className={`flex justify-between items-center cursor-pointer p-2 border-b-2 border-b-gray-800`}
            onClick={(e) => {
              e.preventDefault();
              handleToggleType("online");
            }}
          >
            <span>Online</span>
            <Checkbox
              checked={localParticipationType.includes("online") || localParticipationType.length === 0}
              className="h-6 w-6"
            />
          </div>

          {/* In-person event row */}
          <div
            className={`flex justify-between items-center cursor-pointer p-2`}
            onClick={(e) => {
              e.preventDefault();
              handleToggleType("in_person");
            }}
          >
            <span>In-person</span>
            <Checkbox
              checked={localParticipationType.includes("in_person") || localParticipationType.length === 0}
              className="h-6 w-6"
            />
          </div>
        </div>
        <Button onClick={handleDoneClick}>Done</Button>
      </div>
    </KSheet>
  );
};

export default EventTypeDrawer;
