"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChangeEvent, KeyboardEventHandler, useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";

import searchEventsInputZod from "@/zodSchema/searchEventsInputZod";

import useWebApp from "@/hooks/useWebApp";

import ParticipantErrorDialog from "@/app/_components/SearchBar/ParticipantErrorDialog";
import EventTypeDrawer from "./EventTypeDrawer";
import HubSelectorDrawer from "./HubSelectorDrawer";
import MainFilterDrawer from "./MainFilterDrawer";

import { trpc } from "@/app/_trpc/client";
import parseSearchParams, { allParticipationTypes } from "@/app/search/parseSearchParams";
import { useDebouncedCallback } from "@mantine/hooks";
import { noop } from "lodash";
import { SearchIcon } from "lucide-react";
import CategorySelectorDrawer from "./CategorySelectorDrawer";
import { EventCategoryRow } from "@/db/schema/eventCategories";

/** TypeScript types from your Zod schema */
type SearchEventsInput = z.infer<typeof searchEventsInputZod>;
type FilterType = NonNullable<SearchEventsInput["filter"]>;
type SortBy = SearchEventsInput["sortBy"];
type ParticipationType = FilterType["participationType"];

const buildQueryParams = (newVals: ReturnType<typeof parseSearchParams>) => {
  const pType = (
    Array.isArray(newVals.filter.participationType) ? newVals.filter.participationType : allParticipationTypes
  ).join(",");

  return new URLSearchParams({
    query: newVals.search,
    participationType: pType,
    selectedHubs: newVals.filter.society_hub_id.join(","),
    selectedCategories: newVals.filter.category_id.join(","),
    sortBy: newVals.sortBy,
    eventStatus: newVals.filter.eventStatus,
  });
};

const defaultVal = [] as { id: string; name: string }[];
function SearchBar() {
  const [showDialogParticipantError, setShowDialogParticipantError] = useState(false);

  const [isEventTypeDrawerOpen, setIsEventTypeDrawerOpen] = useState(false);
  const [isHubDrawerOpen, setIsHubDrawerOpen] = useState(false);

  const router = useRouter();
  const webApp = useWebApp();
  const hapticFeedback = webApp?.HapticFeedback;
  const searchParams = useSearchParams();

  /** ---------------
   *  Hubs from API
   * ---------------
   */
  const { data: { hubs } = { hubs: defaultVal } } = trpc.hubs.getHubs.useQuery(undefined, {
    staleTime: Infinity,
    queryKey: ["hubs.getHubs", undefined],
  });

  const isSearchPage = usePathname().includes("/search");

  const parsedSearchParams = useMemo(() => parseSearchParams(searchParams), [searchParams]);
  const {
    filter: { participationType: participationTypeLocal },
  } = parsedSearchParams;

  const defaultFilters = useMemo(
    () => ({
      search: "",
      sortBy: "default" as SortBy,
      filter: {
        participationType: allParticipationTypes,
        society_hub_id: hubs.map((h) => h.id).map(Number),
        eventStatus: "all" as const,
        category_id: [],
      },
    }),
    [hubs]
  );

  const [localFilters, setLocalFilters] = useState<ReturnType<typeof parseSearchParams>>(defaultFilters);
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);

  // Suppose you have `categories` from a TRPC query: `trpc.eventCategories.getAll.useQuery()`
  const { data: categories } = trpc.events.getCategories.useQuery();

  const selectedCategoryIds = localFilters.filter.category_id;

  let categoryText = "All";
  if (categories && selectedCategoryIds.length > 0 && selectedCategoryIds.length !== categories.length) {
    categoryText = selectedCategoryIds
      // Because selectedCategoryIds are numeric strings, parse as Number
      .map((catId) => categories.find((c) => c.category_id === Number(catId))?.name)
      .filter(Boolean)
      .join(", ");
  }
  console.log("Categories:", categories, "Selected IDs:", selectedCategoryIds, "Text:", categoryText);
  useEffect(() => {
    setLocalFilters(parsedSearchParams);
  }, [parsedSearchParams]);

  const applyFilters = useCallback(
    (newVals: ReturnType<typeof parseSearchParams>) => {
      const qs = buildQueryParams({
        ...defaultFilters,
        ...newVals,
        filter: {
          ...defaultFilters.filter,
          ...newVals.filter,
        },
      });

      const searchUrl = `/search?${qs.toString()}`;
      if (!isSearchPage) {
        router.push(searchUrl);
      } else {
        router.replace(searchUrl);
      }
    },
    [defaultFilters, isSearchPage, router, localFilters]
  );

  const debouncedApplyFilters = useDebouncedCallback(applyFilters, 500);
  const handleSearchInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const val = event.target.value;

      setLocalFilters((prev) => {
        const newVal = {
          ...prev,
          search: val,
        };
        if (isSearchPage) debouncedApplyFilters(newVal);
        return newVal;
      });
    },
    [debouncedApplyFilters, isSearchPage]
  );

  /** ---------------
   *  Reset all filters
   * ---------------
   */
  const resetFilters = () => {
    applyFilters(defaultFilters);
    hapticFeedback?.selectionChanged();
  };

  /** ---------------
   *  (Drawer) setParticipationTypes
   * ---------------
   */
  const setParticipationTypes = (types: ParticipationType) => {
    hapticFeedback?.selectionChanged();
    setLocalFilters((prev) => ({
      ...prev,
      filter: {
        ...prev.filter,
        participationType: types.length === 0 ? allParticipationTypes : types,
      },
    }));
  };

  const setSelectedHubsArray = (hubIds: string[]) => {
    if (hubIds.length === 0) {
      setLocalFilters((prev) => ({
        ...prev,
        filter: {
          ...prev.filter,
          society_hub_id: hubs.map((h) => h.id).map(Number),
        },
      }));
    } else {
      setLocalFilters((prev) => ({
        ...prev,
        filter: {
          ...prev.filter,
          society_hub_id: hubIds.map(Number),
        },
      }));
    }
  };

  /** ---------------
   *  "Show all" participant error
   * ---------------
   */
  const handleShowAll = () => {
    setParticipationTypes([]);
    setShowDialogParticipantError(false);
  };

  const {
    filter: { society_hub_id },
  } = localFilters;
  const selectedHubs = society_hub_id || [];
  let hubText = "All";
  if (selectedHubs && selectedHubs?.length !== 0 && selectedHubs?.length !== hubs?.length) {
    hubText = selectedHubs
      .map((hubId: number) => hubs.find((h) => h.id === String(hubId))?.name)
      .filter(Boolean)
      .join(", ");
  }

  const handleSearchFromHome: KeyboardEventHandler = useCallback(
    (e) => {
      if (e.key !== "Enter" || localFilters.search?.length < 2) return;
      setTimeout(() => {
        applyFilters(localFilters);
      }, 10);
    },
    [applyFilters, localFilters, localFilters.filter.eventStatus]
  );

  return (
    <div className="relative flex flex-col">
      {/* Top row: search + filter icon */}
      <div className="relative flex items-center">
        <div className={`flex-grow transition-all duration-300`}>
          <div className="relative mr-3 text-[#8e8e93] focus-within:text-[#007aff]">
            <SearchIcon className="absolute top-[6px] left-2 z-10" />
            <input
              className={`rounded-md bg-[#E0E0E5] w-full py-3 leading-[16px] pl-10 caret-[#007aff] text-black`}
              placeholder="Search Events"
              onChange={handleSearchInputChange}
              onKeyUp={isSearchPage ? noop : handleSearchFromHome}
              value={localFilters.search}
            />
          </div>
        </div>
        <MainFilterDrawer
          hubText={hubText}
          setIsEventTypeDrawerOpen={setIsEventTypeDrawerOpen}
          categoryText={categoryText}
          setIsHubDrawerOpen={setIsHubDrawerOpen}
          resetFilters={resetFilters}
          applyFilters={() => applyFilters(localFilters)}
          participationType={localFilters.filter.participationType}
          sortBy={localFilters.sortBy}
          setIsCategoryDrawerOpen={setIsCategoryDrawerOpen}
          setSortBy={(newSort: SortBy) =>
            setLocalFilters((prev) => ({
              ...prev,
              sortBy: newSort,
            }))
          }
          setFilter={(eventStatus) =>
            // @ts-expect-error
            setLocalFilters((prev) => ({
              ...prev,
              filter: {
                ...prev.filter,
                eventStatus: eventStatus ? eventStatus : undefined,
              },
            }))
          }
          filter={localFilters.filter.eventStatus}
        />
      </div>

      {/* Drawers */}
      <EventTypeDrawer
        isOpen={isEventTypeDrawerOpen}
        onOpenChange={setIsEventTypeDrawerOpen}
        participationType={participationTypeLocal}
        setParticipationTypes={setParticipationTypes}
      />

      <HubSelectorDrawer
        isOpen={isHubDrawerOpen}
        onOpenChange={setIsHubDrawerOpen}
        selectedHubs={selectedHubs.map(String)}
        setSelectedHubs={setSelectedHubsArray}
        hubs={hubs}
      />
      <CategorySelectorDrawer
        isOpen={isCategoryDrawerOpen}
        onOpenChange={setIsCategoryDrawerOpen}
        categories={categories}
        selectedCategories={selectedCategoryIds.map(String)}
        setSelectedCategories={(categoryIds) => {
          // If user unselects all, fallback to "all categories" if desired,
          // or let it be empty array (meaning no categories).
          setLocalFilters((prev) => ({
            ...prev,
            filter: {
              ...prev.filter,
              category_id: categoryIds.map(Number),
            },
          }));
        }}
      />
      {/* If user tries removing both 'online' + 'in_person' */}
      <ParticipantErrorDialog
        open={showDialogParticipantError}
        onClose={() => setShowDialogParticipantError(false)}
        onConfirm={handleShowAll}
      />
    </div>
  );
}

export default SearchBar;
