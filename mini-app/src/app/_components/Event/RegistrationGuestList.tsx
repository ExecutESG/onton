import ButtonPOA from "@/app/_components/atoms/buttons/ButtonPOA";
import OrganizerNotificationHandler from "@/app/_components/OrganizerNotificationHandler";
import { trpc } from "@/app/_trpc/client";
import Typography from "@/components/Typography";
import { KButton } from "@/components/ui/button";
import StatusChip from "@/components/ui/status-chips";
import { EventTriggerType } from "@/db/enum";
import { EventRegistrantStatusType } from "@/db/schema/eventRegistrants";
import { useGetEvent } from "@/hooks/events.hooks";
import { useMainButton } from "@/hooks/useMainButton";
import useWebApp from "@/hooks/useWebApp";
import { cn } from "@/utils";
import { useDebouncedValue } from "@mantine/hooks";
import { cva } from "class-variance-authority";
import { Block, BlockFooter, BlockHeader, BlockTitle, Checkbox, List, ListItem, Sheet } from "konsta/react";
import { Check, FileUser, Filter, Pencil, X } from "lucide-react";
import { useParams } from "next/navigation";
import React, { useCallback, useMemo, useRef, useState } from "react";
import QrCodeButton from "../atoms/buttons/QrCodeButton";
import CustomButton from "../Button/CustomButton";
import DataStatus from "../molecules/alerts/DataStatus";
import CustomSheet from "../Sheet/CustomSheet";
import ScanRegistrantQRCode from "./ScanRegistrantQRCode";

interface CustomListItemProps {
  name: string;
  username: string;
  date: string;
  status: "pending" | "approved" | "rejected" | "checkedin";
  user_id: number;
  registrantInfo: Record<string, string | null> | null;
  handleApprove: (_: number) => Promise<void>;
  handleReject: (_: number) => Promise<void>;
  className?: string;
  hasPayment: boolean;
}

const CustomListItem: React.FC<CustomListItemProps> = ({
  name,
  username,
  date,
  status,
  user_id,
  registrantInfo,
  handleApprove,
  handleReject,
  className,
  hasPayment,
}) => {
  const [isApproving, setIsApproving] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [itemStatus, setItemStatus] = useState(status);
  const [showRegistrantInfo, setShowRegistrantInfo] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  const handleEdit = useCallback(() => {
    setIsEditing(!isEditing);
  }, [isEditing]);

  const handleApproveClick = useCallback(async () => {
    setIsApproving(true);
    try {
      await handleApprove(user_id);
      setItemStatus("approved");
      setIsEditing(false);
    } catch (error) {
      // Handle error (e.g. show toast notification)
    } finally {
      setIsApproving(false);
    }
  }, [handleApprove, user_id]);

  const handleRejectClick = useCallback(async () => {
    setIsDeclining(true);
    try {
      await handleReject(user_id);
      setItemStatus("rejected");
      setIsEditing(false);
    } catch (error) {
      // Handle error
    } finally {
      setIsDeclining(false);
    }
  }, [handleReject, user_id]);

  const { afterContent, footerContent } = useMemo(() => {
    let afterContent;
    let footerContent;

    switch (itemStatus) {
      case "pending":
        afterContent = (
          <div className="flex space-x-2">
            <Button
              icon={<FileUser size={18} />}
              variant="purple"
              onClick={() => setShowRegistrantInfo(registrantInfo)}
            />
            <div className="flex flex-col text-end text-xs">
              <span>{date}</span>
              <span>Registered</span>
            </div>
          </div>
        );
        footerContent = hasPayment ? null : (
          <div className="flex space-x-2">
            <Button
              variant="danger"
              icon={<X size={18} />}
              label="Reject"
              onClick={handleRejectClick}
              isLoading={isDeclining}
            />
            <Button
              variant="success"
              icon={<Check size={19} />}
              label="Approve"
              onClick={handleApproveClick}
              isLoading={isApproving}
            />
          </div>
        );
        break;
      case "approved":
      case "checkedin":
        afterContent = (
          <div className="flex space-x-2">
            <Button
              icon={<FileUser size={18} />}
              variant="purple"
              onClick={() => setShowRegistrantInfo(registrantInfo)}
            />
            {!hasPayment && itemStatus === "approved" && (
              <Button
                icon={<Pencil size={18} />}
                onClick={handleEdit}
              />
            )}
            <StatusChip
              variant={itemStatus === "checkedin" ? "primary" : "success"}
              label={itemStatus}
            />
          </div>
        );
        footerContent =
          hasPayment || itemStatus === "checkedin" || !isEditing ? null : (
            <div className="flex space-x-2">
              <Button
                variant="danger"
                icon={<X size={18} />}
                label="Reject"
                onClick={handleRejectClick}
                isLoading={isDeclining}
              />
            </div>
          );
        break;
      case "rejected":
        afterContent = (
          <div className="flex space-x-2">
            <Button
              icon={<FileUser size={18} />}
              variant="purple"
              onClick={() => setShowRegistrantInfo(registrantInfo)}
            />
            {!hasPayment && (
              <>
                <Button
                  icon={<Pencil size={18} />}
                  onClick={handleEdit}
                />
                <StatusChip
                  variant="danger"
                  label="Rejected"
                />
              </>
            )}
          </div>
        );
        footerContent =
          hasPayment || !isEditing ? null : (
            <div className="flex space-x-2">
              <Button
                variant="success"
                icon={<Check size={19} />}
                label="Approve"
                onClick={handleApproveClick}
                isLoading={isApproving}
              />
            </div>
          );
        break;
      default:
        afterContent = null;
        footerContent = null;
    }
    return { afterContent, footerContent };
  }, [
    itemStatus,
    date,
    hasPayment,
    handleRejectClick,
    isDeclining,
    handleApproveClick,
    isApproving,
    handleEdit,
    isEditing,
    registrantInfo,
  ]);

  return (
    <>
      <ListItem
        className={`!ps-0 ${className || ""}`}
        title={
          <div className="w-44">
            <h4 className="truncate">{name}</h4>
            <p className="text-xs truncate text-cn-muted-foreground">{username}</p>
          </div>
        }
        after={afterContent}
        footer={footerContent}
      />
      <CustomSheet
        title="Registrant Info"
        onClose={() => setShowRegistrantInfo(null)}
        opened={Boolean(showRegistrantInfo)}
      >
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col gap-1">
            {registrantInfo &&
              Object.entries(registrantInfo).map(([key, value], idx) => (
                <li key={idx}>
                  <div className="capitalize">
                    <Typography variant="callout">{key.split("_").join(" ")}</Typography>
                  </div>
                  <div className="font-light">{value || <p className="text-cn-muted-foreground">Not Provided</p>}</div>
                </li>
              ))}
          </ul>
          <CustomButton
            variant="secondary"
            size="md"
            onClick={(e) => {
              setShowRegistrantInfo(null);
            }}
          >
            Close
          </CustomButton>
        </div>
      </CustomSheet>
    </>
  );
};

interface ButtonProps {
  variant?: "primary" | "secondary" | "danger" | "success" | "purple";
  icon?: React.ReactNode;
  label?: string;
  onClick?: () => void;
  isLoading?: boolean;
  className?: string;
}

const Button: React.FC<ButtonProps> = ({ variant, icon, label, onClick, isLoading, className }) => {
  const variantStyles = cva("", {
    variants: {
      variant: {
        primary: "",
        secondary: "k-color-brand-gray",
        danger: "k-color-brand-red",
        success: "k-color-brand-green",
        purple: "k-color-brand-purple",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  });

  return (
    <KButton
      rounded
      className={cn(variantStyles({ variant, className }))}
      tonal
      small
      onClick={(e) => {
        onClick?.();
      }}
      disabled={isLoading}
    >
      {icon && <span>{icon}</span>}
      {label && <span>{label}</span>}
    </KButton>
  );
};

const RegistrationGuestList = () => {
  const params = useParams<{ hash: string }>();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 500);
  const eventData = useGetEvent();
  const webApp = useWebApp();

  // Local state for filtering
  const [filters, setFilters] = useState<EventRegistrantStatusType[]>([]);
  const [tempFilters, setTempFilters] = useState<EventRegistrantStatusType[]>([]);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // Use the same logic for statuses both in input and in queryKey.
  const statusesQueryValue = filters.length > 0 ? filters : undefined;

  const registrantsQuery = trpc.registrant.getEventRegistrants.useInfiniteQuery(
    {
      event_uuid: params.hash,
      search: debouncedSearch.length >= 3 ? debouncedSearch : "",
      statuses: statusesQueryValue, // use undefined when filters is empty
      limit: 10,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      staleTime: 10_000,
      queryKey: [
        "registrant.getEventRegistrants",
        { event_uuid: params.hash, search: debouncedSearch, statuses: statusesQueryValue },
      ],
    }
  );

  // Compute a flat list of registrants from all pages.
  const registrantList = useMemo(() => {
    if (!registrantsQuery.data) return [];
    return registrantsQuery.data.pages.flatMap((page) => page.registrants);
  }, [registrantsQuery.data]);

  // Intersection Observer to load more when the last item is visible.
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastItemRef = useCallback(
    (node: HTMLElement | null) => {
      if (registrantsQuery.isFetchingNextPage) return;
      if (observerRef.current) observerRef.current.disconnect();
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && registrantsQuery.hasNextPage) {
          registrantsQuery.fetchNextPage();
        }
      });
      if (node) observerRef.current.observe(node);
    },
    [registrantsQuery]
  );

  // Filter sheet handlers
  const toggleTempFilter = useCallback((status: EventRegistrantStatusType) => {
    setTempFilters((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]));
  }, []);

  const openFilterSheet = useCallback(() => {
    setTempFilters(filters);
    setIsFilterSheetOpen(true);
  }, [filters]);

  // When applying filters, update the filters state.
  const applyFilters = useCallback(() => {
    setFilters(tempFilters);
    setIsFilterSheetOpen(false);
    // With the query key based on filters, the query will refetch automatically.
  }, [tempFilters]);

  // When clearing filters, set filters to an empty array and force a refetch.
  const removeFilters = useCallback(() => {
    setTempFilters([]);
    setFilters([]);
    setIsFilterSheetOpen(false);
  }, []);

  const processRegistrantRequest = trpc.registrant.processRegistrantRequest.useMutation({
    onSuccess: () => {
      // Refetch after a mutation so that the list updates correctly.
      registrantsQuery.refetch();
    },
  });

  const exportVisitorList = trpc.telegramInteractions.requestExportFile.useMutation({
    onSuccess: () => {
      webApp?.HapticFeedback.impactOccurred("soft");
      webApp?.close();
    },
  });

  const hasPayment = eventData.data?.has_payment || false;

  useMainButton(
    () => {
      exportVisitorList.mutate({
        event_uuid: params.hash,
      });
    },
    "Download List Excel",
    {
      isLoading: exportVisitorList.isLoading,
      disabled: exportVisitorList.isLoading,
    }
  );

  const handleApprove = useCallback(
    async (user_id: number) => {
      await processRegistrantRequest.mutateAsync({
        event_uuid: params.hash,
        status: "approved",
        user_id,
      });
    },
    [processRegistrantRequest, params.hash]
  );

  const handleReject = useCallback(
    async (user_id: number) => {
      await processRegistrantRequest.mutateAsync({
        event_uuid: params.hash,
        status: "rejected",
        user_id,
      });
    },
    [processRegistrantRequest, params.hash]
  );

  return (
    <>
      <BlockTitle medium>{eventData.data?.title}</BlockTitle>
      <Block className="!-mb-8">
        <QrCodeButton
          event_uuid={params.hash}
          url={`https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=${params.hash}`}
          hub={eventData.data?.society_hub?.name!}
          activity_id={eventData.data?.activity_id}
          hidden={eventData.data?.hidden}
        />

        {eventData.data?.participationType === "online" &&
          ((eventData.data?.enabled && eventData.data?.has_payment) || !eventData.data?.has_payment) && (
            <>
              <ButtonPOA
                event_uuid={params.hash}
                poa_type={"password" as EventTriggerType}
                showPOAButton={Boolean(eventData.data?.isNotEnded && eventData.data?.isStarted)}
              />
              <OrganizerNotificationHandler />
            </>
          )}
      </Block>

      <BlockTitle medium>
        <span>Guest List</span>
        <div className="flex gap-3 items-center">
          <Filter
            onClick={(e) => {
              openFilterSheet();
            }}
            className={cn(
              "rounded cursor-pointer",
              filters.length ? "text-primary bg-primary/10" : "text-cn-muted-foreground"
            )}
          />
          {eventData.data?.participationType === "in_person" && <ScanRegistrantQRCode />}
        </div>
      </BlockTitle>

      <Block>
        <input
          type="text"
          placeholder="Search by username or name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="p-2 border rounded w-full"
        />
      </Block>

      <BlockHeader className="font-bold">
        {registrantsQuery.isSuccess && registrantList.length === 0 && (
          <DataStatus
            status="not_found"
            title="No Registrants Yet"
            description="No one has filled the form yet."
          />
        )}
        {!registrantsQuery.isFetched && registrantsQuery.isLoading && (
          <DataStatus
            status="searching"
            title="Loading Guest List"
          />
        )}
        {registrantsQuery.isError &&
          (registrantsQuery.error.data?.code === "NOT_FOUND" ? (
            <DataStatus
              status="not_found"
              title="Event Not Found"
              description={`Event does not exist with id = ${params.hash}`}
            />
          ) : (
            <DataStatus
              status="danger"
              title="Something Went Wrong with Registrant"
              description="There was a problem; try refreshing the page."
            />
          ))}
      </BlockHeader>

      <Sheet
        onBackdropClick={() => setIsFilterSheetOpen(false)}
        opened={isFilterSheetOpen}
        className="!overflow-hidden w-full"
      >
        <BlockTitle>Filter Registrants</BlockTitle>
        <List>
          {(["pending", "rejected", "approved", "checkedin"] as EventRegistrantStatusType[]).map((status) => (
            <ListItem
              key={status}
              label
              className="capitalize"
              title={status}
              media={
                <Checkbox
                  value={status}
                  checked={tempFilters.includes(status)}
                  onChange={() => toggleTempFilter(status)}
                />
              }
            />
          ))}
        </List>
        <BlockFooter className="flex flex-col gap-1">
          {filters.length > 0 && (
            <KButton
              clear
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                removeFilters();
              }}
            >
              Clear Filters
            </KButton>
          )}
          <KButton
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              applyFilters();
            }}
          >
            Apply
          </KButton>
        </BlockFooter>
      </Sheet>

      <List className="!my-2">
        {registrantList.map((registrant, idx) => {
          const isLastItem = idx === registrantList.length - 1;
          return (
            <div
              key={`registrant_${idx}`}
              ref={isLastItem ? lastItemRef : null}
            >
              <CustomListItem
                name={registrant.first_name || "No Name"}
                username={registrant.username || "no username"}
                date={
                  registrant.created_at
                    ? new Date(registrant.created_at).toLocaleString("default", {
                        month: "short",
                        day: "numeric",
                      })
                    : "no_date"
                }
                registrantInfo={registrant.registrant_info}
                user_id={registrant.user_id!}
                status={registrant.status}
                handleApprove={() => handleApprove(registrant.user_id!)}
                handleReject={() => handleReject(registrant.user_id!)}
                className={cn(isLastItem && "last-guest-item")}
                hasPayment={hasPayment}
              />
            </div>
          );
        })}
        {registrantsQuery.isFetchingNextPage && (
          <DataStatus
            status="searching"
            title="Loading more registrants..."
          />
        )}
      </List>
    </>
  );
};

export default RegistrationGuestList;
