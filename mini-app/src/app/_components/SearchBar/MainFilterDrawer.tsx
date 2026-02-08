"use client";
import { allParticipationTypes } from "@/app/search/parseSearchParams";
import { KButton } from "@/components/ui/button";
import { KSheet } from "@/components/ui/drawer";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio";
import searchEventsInputZod, { eventStatusValues } from "@/zodSchema/searchEventsInputZod";
import React from "react";
import { IoIosArrowForward } from "react-icons/io";
import { IoOptionsOutline } from "react-icons/io5";
import { z } from "zod";

/** The union from your Zod schema: 'default' | 'time' | 'most_people_reached' | etc. */
export type SortByType = z.infer<typeof searchEventsInputZod>["sortBy"];

/** This is how you want the parent to set the sort:
 *  i.e. (newValue: SortByType) => void
 */

interface MainFilterDrawerProps {
  hubText: string;
  setIsEventTypeDrawerOpen: (open: boolean) => void;
  setIsHubDrawerOpen: (open: boolean) => void;
  resetFilters: () => void;
  applyFilters: () => void;
  participationType: ("online" | "in_person")[];
  sortBy: SortByType;
  setSortBy: (_s: SortByType) => void;
  setFilter: (eventStatus: (typeof eventStatusValues)[number] | undefined) => void;
  filter: (typeof eventStatusValues)[number] | undefined;
  categoryText: string;
  setIsCategoryDrawerOpen: (open: boolean) => void;
}

const MainFilterDrawer: React.FC<MainFilterDrawerProps> = ({
  hubText,
  setIsEventTypeDrawerOpen,
  setIsHubDrawerOpen,
  resetFilters,
  applyFilters,
  participationType,
  sortBy,
  filter,
  setSortBy,
  setFilter,
  categoryText,
  setIsCategoryDrawerOpen,

  // applyingFilters,
  // setApplyingFilters,
}) => {
  return (
    <KSheet
      trigger={(open, setOpen) => (
        <button
          onClick={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
          className="p-[6px] rounded-md text-gray-500 hover:text-gray-700 bg-[#7474801F]"
        >
          <IoOptionsOutline className="w-7 h-7" />
        </button>
      )}
    >
      {(open, setOpen) => (
        <>
          <div className="p-4 py-4 space-y-2 cursor-pointer">
            {/* EVENT TYPE */}
            <div
              className="space-y-3 border-b-[1px] pb-1"
              onClick={(e) => {
                e.preventDefault();
                setIsEventTypeDrawerOpen(true);
              }}
            >
              <p className=" font-medium">Event Type</p>
              <div className="cursor-pointer text-sm flex items-center">
                {participationType.length === 0 || participationType.length === allParticipationTypes.length
                  ? "All"
                  : participationType.join(", ").replace("_", " ")}
                <IoIosArrowForward className="ml-auto" />
              </div>
            </div>

            {/* HUB SELECTOR */}
            <div
              className="flex items-center cursor-pointer border-b pb-1"
              onClick={(e) => {
                e.preventDefault();
                setIsHubDrawerOpen(true);
              }}
            >
              <div className="flex-1 space-y-3">
                <p className="font-medium">Ton Hub</p>
                <div className="text-sm line-clamp-1 w-11/12 overflow-hidden">{hubText}</div>
              </div>
              <IoIosArrowForward className="text-sm ml-2 mt-8" />
            </div>
            <div
              className="flex items-center cursor-pointer border-b pb-1"
              onClick={(e) => {
                e.preventDefault();
                setIsCategoryDrawerOpen(true);
              }} // <-- We'll define this state soon
            >
              <div className="flex-1 space-y-3">
                <p className="font-medium">Categories</p>
                <div className="text-sm line-clamp-1 w-11/12 overflow-hidden">{categoryText}</div>
              </div>
              <IoIosArrowForward className="text-sm ml-2 mt-8" />
            </div>
            {/* SORT BY */}
            <div className="space-y-4">
              <p className="text-sm font-medium pt-2">Sort By</p>
              <RadioGroup
                orientation="vertical"
                /* The RadioGroup wants a string, so `sortBy` is also a string union.
                   If TS complains, cast: (sortBy as string) */
                value={sortBy}
                onValueChange={(value) => {
                  // 'value' is always string -> cast to SortByType
                  setSortBy(value as SortByType);
                }}
              >
                <label className="flex justify-between items-center border-b-[1px] pb-2">
                  <span className="text-sm">Time</span>
                  <RadioGroupItem
                    value="start_date_desc"
                    className="h-4 w-4"
                  />
                </label>
                <label className="flex justify-between items-center">
                  <span className="text-sm">Most People Reached</span>
                  <RadioGroupItem
                    value="most_people_reached"
                    className="h-4 w-4"
                  />
                </label>
              </RadioGroup>
            </div>
            {/* FILTER */}
            <div className="space-y-4">
              <p className="text-sm font-medium pt-2">Filter</p>
              <RadioGroup
                orientation="vertical"
                value={filter || "all"}
                onValueChange={(value) => {
                  if (value === "all") {
                    setFilter(undefined);
                  }
                  setFilter(value as (typeof eventStatusValues)[number]);
                }}
              >
                <label className="flex justify-between items-center border-b-[1px] pb-2">
                  <span className="text-sm">All</span>
                  <RadioGroupItem
                    value="all"
                    className="h-4 w-4"
                  />
                </label>
                <label className="flex justify-between items-center border-b-[1px] pb-2">
                  <span className="text-sm">Ongoing</span>
                  <RadioGroupItem
                    value="ongoing"
                    className="h-4 w-4"
                  />
                </label>
                <label className="flex justify-between items-center">
                  <span className="text-sm">Upcoming</span>
                  <RadioGroupItem
                    value="upcoming"
                    className="h-4 w-4"
                  />
                </label>
              </RadioGroup>
            </div>
          </div>

          {/* APPLY / RESET BUTTONS */}
          <div className="flex gap-1 pt-0 p-4 flex-col">
            <KButton
              className="py-5 rounded-3xl"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                applyFilters();
                setOpen(false);
              }}
            >
              Apply filters
            </KButton>
            <KButton
              tonal
              className="py-5 rounded-3xl"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                resetFilters();
                setOpen(false);
              }}
            >
              Reset filters
            </KButton>
          </div>
        </>
      )}
    </KSheet>
  );
};

export default MainFilterDrawer;
