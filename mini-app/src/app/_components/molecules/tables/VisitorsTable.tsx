import { trpc } from "@/app/_trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useWebApp from "@/hooks/useWebApp";
import { useIntersection } from "@mantine/hooks";
import Image from "next/image";
import { FC, useEffect, useMemo, useRef, useState } from "react";
import { FaCloudDownloadAlt } from "react-icons/fa";
import VisitorRow from "./VisitorRow";

export type Visitor = {
  user_id: number | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  wallet_address: string | null;
  created_at: string | null;
  has_ticket: boolean;
  ticket_status: string | null;
  ticket_id: number | null;
};

interface VisitorsTableProps {
  event_uuid: string;
  handleVisitorsExport: () => void;
  setNeedRefresh: (_data: any) => void;
  needRefresh: boolean;
}

const VisitorsTable: FC<VisitorsTableProps> = ({ event_uuid, handleVisitorsExport, setNeedRefresh, needRefresh }) => {
  const webApp = useWebApp();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showNoResults, setShowNoResults] = useState(false); // State to control the delay message
  const [isTyping, setIsTyping] = useState(false);
  const {
    fetchNextPage,
    data,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingVisitors,
    refetch: refetchVisitors,
  } = trpc.visitors.getAll.useInfiniteQuery(
    {
      event_uuid,
      // @ts-expect-error
      init_data: webApp?.initData,
      limit: 50,
      dynamic_fields: false,

      search: debouncedSearchQuery,
    },
    {
      getNextPageParam: (lastPage) => lastPage?.nextCursor || null,
      initialCursor: 0,
      enabled: Boolean(event_uuid) && Boolean(webApp?.initData),
      retry: false,
      cacheTime: 20,
    }
  );

  const lastItemRef = useRef<HTMLDivElement>(null);
  const { ref, entry } = useIntersection({
    root: lastItemRef.current,
    threshold: 0.2,
  });

  useEffect(() => {
    if (needRefresh) {
      refetchVisitors().then(() => {
        setNeedRefresh(false);
      });
    }
  }, [needRefresh, refetchVisitors, setNeedRefresh]);

  useEffect(() => {
    if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [entry, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Debouncing search query
  // Debouncing search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setIsTyping(false); // User has stopped typing
    }, 700); // 300ms delay to stabilize typing
    setIsTyping(true); // User is typing
    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);
  // Flatten all pages to include newly fetched data
  const flatData: Visitor[] = useMemo(() => {
    // @ts-expect-error
    return data?.pages.flatMap((page) => page?.visitorsData) || [];
  }, [data?.pages]);

  // Check the visitor count on the first page
  const firstPageVisitorCount = data?.pages[0]?.visitorsData.length || 0;

  // Memoized filtered visitors
  const filteredVisitors = useMemo(() => {
    if (!flatData) return [];

    return flatData.filter((visitor) => {
      const matchesSearch =
        visitor?.username?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        `${visitor?.first_name} ${visitor?.last_name}`.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Waiting" && visitor.ticket_status === "UNUSED") ||
        (statusFilter === "Checked-In" && visitor.ticket_status === "USED");

      return matchesSearch && matchesStatus;
    });
  }, [flatData, debouncedSearchQuery, statusFilter]);

  // Check if there are no events after filtering and display immediately if there are no results on load
  useEffect(() => {
    if (!isFetchingNextPage && !isTyping && filteredVisitors.length === 0) {
      // console.log("isFetchingNextPage:", isFetchingNextPage);
      // console.log("debouncedSearchQuery:", debouncedSearchQuery);
      // console.log("filteredVisitors Length:", filteredVisitors.length);
      // console.log("showNoResults:", showNoResults);
      // console.log("isTyping:", isTyping);
      // console.log("===================================");

      if (
        debouncedSearchQuery.length === 0 ||
        (debouncedSearchQuery.length > 0 && filteredVisitors.length === 0 && !isFetchingNextPage && !isLoadingVisitors)
      ) {
        setShowNoResults(true); // Show message immediately if no results and not loading
      }
    } else {
      setShowNoResults(false); // Reset the message if results are found or search changes
    }
  }, [debouncedSearchQuery, filteredVisitors, isFetchingNextPage, isLoadingVisitors, isTyping]);

  return (
    <div className="mt-0 overflow-x-auto">
      <div className="w-full p-0">
        {/* Search Bar */}
        <Input
          type="text"
          placeholder="Search by username or name"
          value={searchQuery}
          onChange={(e) => {
            const value = e.target.value;
            setSearchQuery(value);
            if (value.length >= 3) {
              setDebouncedSearchQuery(value);
            }
          }}
          className="mb-4 mt-4"
        />

        <div className="flex flex-col py-0">
          <div className="flex w-full p-0 border-b-gray-800 border-b-2">
            <div className="inline-flex py-0 items-center text-lg w-full">
              {data?.pages[0]?.event.has_payment ? (
                <Tabs
                  defaultValue="All"
                  className="bg-transparent px-0 py-0"
                  onValueChange={(value) => setStatusFilter(value)}
                >
                  <TabsList className="bg-transparent px-0">
                    <TabsTrigger
                      className="px-4 py-0 data-[state=active]:font-bold"
                      value="All"
                    >
                      All
                    </TabsTrigger>
                    <TabsTrigger
                      className="px-4 py-0 border-x-2 border-x-gray-600 rounded-none text-gray-500 data-[state=active]:text-gray-100 data-[state=active]:font-bold"
                      value="Waiting"
                    >
                      Waiting
                    </TabsTrigger>
                    <TabsTrigger
                      className="px-4 py-0 text-gray-500 data-[state=active]:text-gray-100 data-[state=active]:font-bold"
                      value="Checked-In"
                    >
                      Checked-In
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              ) : (
                "Guests"
              )}
              {/* Conditionally render the Download All button */}
              {firstPageVisitorCount > 1 && (
                <Button
                  variant="link"
                  className="ml-auto flex items-center text-xs py-0 px-0 no-underline hover:no-underline"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleVisitorsExport();
                  }}
                >
                  <FaCloudDownloadAlt className="mr-2" /> Download All
                </Button>
              )}
            </div>
          </div>
          {showNoResults ? (
            <div className="flex flex-col  animate-fade items-center justify-center  mt-12 text-center space-y-4  ">
              <div>
                <Image
                  src={"/template-images/no-guest.png"}
                  alt={"No search results found"}
                  width={180}
                  height={180}
                />
              </div>
              <div className="text-gray-500 max-w-md">
                Nothing Was Found <br />
                Try to enter other keywords
              </div>
            </div>
          ) : isLoadingVisitors ? (
            <div className="flex flex-col animate-pulse items-center justify-center mt-12 text-center space-y-4">
              <div className="text-gray-500 max-w-md">Loading...</div>
            </div>
          ) : (
            filteredVisitors.map((visitor, index) => {
              if (!visitor) {
                return null;
              }

              return (
                <VisitorRow
                  key={visitor.user_id}
                  visitor={visitor}
                  refProp={index === filteredVisitors.length - 1 ? ref : null}
                  webApp={webApp}
                  index={index}
                  isLast={index === filteredVisitors.length - 1}
                  needRefresh={needRefresh}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default VisitorsTable;
