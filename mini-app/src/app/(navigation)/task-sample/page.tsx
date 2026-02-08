"use client";
import { trpc } from "@/app/_trpc/client"; // your TRPC client
import Typography from "@/components/Typography";
import { useUserStore } from "@/context/store/user.store";
import { taskTypeEnum, TaskTypeType } from "@/db/schema/tasks";
import { TRPCClientError } from "@trpc/client";
import React, { useState } from "react";
import { toast } from "sonner";

/**
 * Example "TasksTestPage" for demonstrating:
 *   1) Auto-fetching "Join ONTON" affiliate link on load
 *   2) Displaying the link in a text input
 *   3) A "Share" button that calls `requestShareJoinOntonAffiliate`
 *
 *   Other existing sections remain, but the relevant part is
 *   the updated "Join ONTON" affiliate link logic near the bottom.
 */
export default function TasksTestPage() {
  const { user } = useUserStore();
  const userId = user?.user_id;

  // ========================================
  // Existing code for demonstration:
  // tasks by type, tasks by group, etc.
  // ========================================

  const [taskType, setTaskType] = useState<TaskTypeType>(taskTypeEnum.enumValues[0]);
  const [onlyAvailableNow, setOnlyAvailableNow] = useState(false);
  const getTasksByTypeQuery = trpc.task.getTasksByType.useQuery({ taskType, onlyAvailableNow }, { enabled: false });

  const handleGetTasksByType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await getTasksByTypeQuery.refetch();
    } catch (err) {
      if (err instanceof TRPCClientError) {
        toast.error(err.message);
      } else {
        toast.error("An unknown error occurred while fetching tasks.");
      }
    }
  };

  const [groupId, setGroupId] = useState<number>(1);
  const getTasksByGroupQuery = trpc.task.getTasksByGroup.useQuery({ groupId }, { enabled: false });

  const handleGetTasksByGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await getTasksByGroupQuery.refetch();
    } catch (err) {
      if (err instanceof TRPCClientError) {
        toast.error(err.message);
      } else {
        toast.error("An unknown error occurred while fetching group tasks.");
      }
    }
  };

  const getAvailablePeriodTasksQuery = trpc.task.getAvailablePeriodTasks.useQuery(undefined, {
    enabled: false,
  });

  const handleGetAvailablePeriodTasks = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await getAvailablePeriodTasksQuery.refetch();
    } catch (err) {
      if (err instanceof TRPCClientError) {
        toast.error(err.message);
      } else {
        toast.error("An unknown error occurred while fetching available period tasks.");
      }
    }
  };

  // ========================================
  // 4) GET ONTON JOIN AFFILIATE DATA (auto-fetch on load)
  // ========================================
  /**
   * We'll fetch { linkHash: string, joined: number } automatically once user is loaded.
   * We'll store the affiliateLink in local state to display in a <input />.
   */
  const [affiliateLink, setAffiliateLink] = useState<string>("");
  const [joinedCount, setJoinedCount] = useState<number>(0);

  const ontonJoinAffiliateDataQuery = trpc.task.getOntonJoinAffiliateData.useQuery(undefined, {
    enabled: !!userId, // auto-fetch once userId is known
    onSuccess: (data) => {
      setAffiliateLink(data.linkHash);
      setJoinedCount(data.joined);
    },
    onError: (err) => {
      if (err instanceof TRPCClientError) {
        toast.error(err.message);
      } else {
        toast.error("An unknown error occurred while fetching affiliate data.");
      }
    },
  });

  // A separate mutation for "Share"
  const shareJoinOntonAffiliateMutation = trpc.task.requestShareJoinOntonAffiliate.useMutation({
    onSuccess: () => {
      toast.success("Affiliate link shared successfully!");
    },
    onError: (err) => {
      if (err instanceof TRPCClientError) {
        toast.error(err.message);
      } else {
        toast.error("An unknown error occurred while sharing the affiliate link.");
      }
    },
  });

  const handleShareOntonLink = async () => {
    // Just call the mutation
    shareJoinOntonAffiliateMutation.mutate();
  };

  return (
    <div className="p-8">
      <Typography
        variant="headline"
        className="text-2xl font-bold mb-4"
      >
        Tasks Test Page
      </Typography>
      <p className="text-gray-700 mb-6">
        Logged in user ID: <strong>{userId || "N/A"}</strong>
      </p>

      {/* ====================================== */}
      {/* 1) GET TASKS BY TYPE SECTION          */}
      {/* ====================================== */}
      <section className="mb-8 border border-gray-300 p-4 rounded shadow-sm">
        <Typography
          variant="headline"
          className="text-lg font-semibold mb-2"
        >
          Get Tasks By Type
        </Typography>
        <form
          onSubmit={handleGetTasksByType}
          className="space-y-4"
        >
          <div>
            <label className="block mb-1 font-medium">
              Task Type:
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value as TaskTypeType)}
                className="block w-full mt-1 p-2 border border-gray-300 rounded bg-white"
              >
                {taskTypeEnum.enumValues.map((tt) => (
                  <option
                    key={tt}
                    value={tt}
                  >
                    {tt}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              id="availNow"
              type="checkbox"
              checked={onlyAvailableNow}
              onChange={(e) => setOnlyAvailableNow(e.target.checked)}
            />
            <label htmlFor="availNow">Only Available Now</label>
          </div>

          <button
            type="submit"
            className="py-2 w-full bg-blue-600 text-white rounded hover:bg-blue-700"
            disabled={getTasksByTypeQuery.isFetching}
          >
            {getTasksByTypeQuery.isFetching ? "Loading..." : "Get Tasks"}
          </button>
        </form>

        {getTasksByTypeQuery.error && <p className="mt-2 text-red-600">Error: {getTasksByTypeQuery.error.message}</p>}
        {getTasksByTypeQuery.data?.tasks && (
          <ul className="mt-2 list-disc list-inside text-gray-800">
            {getTasksByTypeQuery.data.tasks.map((task) => (
              <li key={task.id}>
                <strong>{task.title}</strong> (ID #{task.id})
                {task.userTaskStatus && (
                  <span className="ml-2 text-sm text-gray-600">[User Status: {task.userTaskStatus.status}]</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ====================================== */}
      {/* 2) GET TASKS BY GROUP                 */}
      {/* ====================================== */}
      <section className="mb-8 border border-gray-300 p-4 rounded shadow-sm">
        <Typography
          variant="headline"
          className="text-lg font-semibold mb-2"
        >
          Get Tasks By Group
        </Typography>
        <form
          onSubmit={handleGetTasksByGroup}
          className="space-y-4"
        >
          <div>
            <label className="block mb-1 font-medium">
              Group ID:
              <input
                type="number"
                className="block w-full mt-1 p-2 border border-gray-300 rounded"
                value={groupId}
                onChange={(e) => setGroupId(parseInt(e.target.value, 10))}
              />
            </label>
          </div>

          <button
            type="submit"
            className="py-2 w-full bg-blue-600 text-white rounded hover:bg-blue-700"
            disabled={getTasksByGroupQuery.isFetching}
          >
            {getTasksByGroupQuery.isFetching ? "Loading..." : "Get Group Tasks"}
          </button>
        </form>

        {getTasksByGroupQuery.error && <p className="mt-2 text-red-600">Error: {getTasksByGroupQuery.error.message}</p>}
        {getTasksByGroupQuery.data && (
          <>
            {getTasksByGroupQuery.data.tasks === null ? (
              <p className="mt-2 text-gray-800">{getTasksByGroupQuery.data.message}</p>
            ) : (
              <ul className="mt-2 list-disc list-inside text-gray-800">
                {getTasksByGroupQuery.data.tasks?.map((task) => (
                  <li key={task.id}>
                    <strong>{task.title}</strong> (ID #{task.id})
                    {task.userTaskStatus && (
                      <span className="ml-2 text-sm text-gray-600">[User Status: {task.userTaskStatus.status}]</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {/* ====================================== */}
      {/* 3) GET AVAILABLE PERIOD TASKS         */}
      {/* ====================================== */}
      <section className="mb-8 border border-gray-300 p-4 rounded shadow-sm">
        <Typography
          variant="headline"
          className="text-lg font-semibold mb-2"
        >
          Get Available Period Tasks
        </Typography>
        <form
          onSubmit={handleGetAvailablePeriodTasks}
          className="space-y-4"
        >
          <button
            type="submit"
            className="py-2 w-full bg-blue-600 text-white rounded hover:bg-blue-700"
            disabled={getAvailablePeriodTasksQuery.isFetching}
          >
            {getAvailablePeriodTasksQuery.isFetching ? "Loading..." : "Get Available Tasks"}
          </button>
        </form>
        {getAvailablePeriodTasksQuery.error && (
          <p className="mt-2 text-red-600">Error: {getAvailablePeriodTasksQuery.error.message}</p>
        )}
        {getAvailablePeriodTasksQuery.data?.tasks && (
          <ul className="mt-2 list-disc list-inside text-gray-800">
            {getAvailablePeriodTasksQuery.data.tasks.map((task) => (
              <li key={task.id}>
                <strong>{task.title}</strong> (ID #{task.id})
                {task.userTaskStatus && (
                  <span className="ml-2 text-sm text-gray-600">[User Status: {task.userTaskStatus.status}]</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ====================================== */}
      {/* 4) JOIN ONTON AFFILIATE LINK SECTION  */}
      {/* ====================================== */}
      <section className="mb-8 border border-gray-300 p-4 rounded shadow-sm">
        <Typography
          variant="headline"
          className="text-lg font-semibold mb-2"
        >
          Your "Join ONTON" Affiliate Link
        </Typography>

        {ontonJoinAffiliateDataQuery.isLoading && <p className="text-gray-600">Loading affiliate link...</p>}

        {/* If we have an affiliate link, show it in an input field so user can copy */}
        <div className="mt-2 space-y-2">
          <label className="block mb-1 font-medium">
            Affiliate Link:
            <input
              type="text"
              value={affiliateLink}
              readOnly
              className="block w-full mt-1 p-2 border border-gray-300 rounded"
            />
          </label>
          <p className="text-gray-600">
            <strong>Joined Count:</strong> {joinedCount}
          </p>
        </div>

        {/* SHARE button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleShareOntonLink();
          }}
          className="px-4 py-2 mt-3 bg-blue-600 text-white rounded hover:bg-blue-700"
          disabled={shareJoinOntonAffiliateMutation.isLoading}
        >
          {shareJoinOntonAffiliateMutation.isLoading ? "Sharing..." : "Share Affiliate Link"}
        </button>
      </section>
    </div>
  );
}
