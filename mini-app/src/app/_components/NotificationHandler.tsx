"use client";

import { Input } from "@/components/ui/input";
import { NotificationItemType, NotificationStatus, NotificationType } from "@/db/enum";
import useWebApp from "@/hooks/useWebApp";
import useNotificationStore from "@/zustand/useNotificationStore";
import { useSocketStore } from "@/zustand/useSocketStore";
import { Dialog, DialogButton } from "konsta/react";
import { useRouter } from "next/navigation"; // For programmatic navigation in Next.js 13
import React, { useEffect, useState } from "react";

type Notification = {
  notificationId: string;
  userId: number;
  type: NotificationType;
  title: string;
  desc: string;
  actionTimeout: number;
  additionalData: {
    participant_id?: number;
    event_id?: number;
    poa_id?: string;
    notification_id?: number;
    eventUuid?: string; // Important for POA_PASSWORD to link back to event
    has_payment?: boolean;
  };
  priority: number;
  itemId: string;
  item_type: NotificationItemType;
  status: NotificationStatus;
  createdAt: string;
  expiresAt: string;
  id: string;
};

const NotificationHandler: React.FC = () => {
  const router = useRouter();
  const WebApp = useWebApp();
  const hapticFeedback = WebApp?.HapticFeedback;
  const notifications = useNotificationStore((state) => state.notifications);
  const socket = useSocketStore((state) => state.socket);

  const [handledNotificationIds, setHandledNotificationIds] = useState<Set<string>>(new Set());
  const [notificationToShow, setNotificationToShow] = useState<Notification | undefined>(undefined);

  // For POA_PASSWORD
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [hasExceededAttempts, setHasExceededAttempts] = useState(false);

  // States for success dialog
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successEventUuid, setSuccessEventUuid] = useState<string | undefined>();
  const [successEventHasPayment, setSuccessEventHasPayment] = useState<boolean>(false);

  // 5-second countdown after showing success dialog
  const [redirectCountdown, setRedirectCountdown] = useState<number>(0);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Listen for notifications
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const newNotification = notifications.find(
      (n) => (n.type === "POA_PASSWORD" || n.type === "POA_SIMPLE") && !handledNotificationIds.has(n.notificationId)
    );

    if (newNotification) {
      setNotificationToShow(newNotification);
      const timeoutValue = Number(newNotification.actionTimeout) || 0;
      setTimeLeft(timeoutValue);

      hapticFeedback?.impactOccurred("heavy");
      setHandledNotificationIds((prev) => new Set(prev).add(newNotification.notificationId));
    }
  }, [notifications, handledNotificationIds, hapticFeedback]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Handle countdown for the current notification
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!notificationToShow || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [notificationToShow, timeLeft]);

  // Auto close notification dialog when time hits 0
  useEffect(() => {
    if (notificationToShow && timeLeft === 0) {
      handleClose();
    }
  }, [timeLeft, notificationToShow]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Listen for "notification_close" event from backend
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleNotificationClose = (data: { notificationId: number }) => {
      if (notificationToShow && Number(notificationToShow.notificationId) === data.notificationId) {
        handleClose();
      }
    };

    socket.on("notification_close", handleNotificationClose);

    return () => {
      socket.off("notification_close", handleNotificationClose);
    };
  }, [socket, notificationToShow]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Success dialog countdown
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (showSuccessDialog && successEventUuid) {
      // Start a 5-second countdown
      setRedirectCountdown(5);
    }
  }, [showSuccessDialog, successEventUuid]);

  // Decrement the countdown each second; if it hits 0, redirect
  useEffect(() => {
    if (!showSuccessDialog || !successEventUuid || redirectCountdown <= 0) return;

    const timer = setInterval(() => {
      setRedirectCountdown((prev) => {
        const nextVal = prev - 1;
        if (nextVal <= 0) {
          clearInterval(timer);
          closeSuccessDialogAndRedirect();
        }
        return nextVal;
      });
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redirectCountdown, showSuccessDialog, successEventUuid]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Handlers
  // ─────────────────────────────────────────────────────────────────────────────
  const handleConfirmPassword = () => {
    if (!socket || !notificationToShow) return;
    setPasswordError("");

    socket.emit(
      "notification_reply",
      {
        notificationId: notificationToShow.notificationId,
        answer: password,
        type: "POA_PASSWORD",
      },
      (response: { status: string; message: string }) => {
        if (response.status === "password_error" || response.status === "error") {
          setPasswordError(response.message);
        } else if (response.status === "password_attempts_error") {
          setPasswordError(response.message);
          setHasExceededAttempts(true);
        } else if (response.status === "success") {
          // Password is correct => show success dialog
          setSuccessEventUuid(notificationToShow.additionalData.eventUuid);
          setSuccessEventHasPayment(notificationToShow.additionalData?.has_payment || false);
          handleClose(); // close the password entry dialog
          setShowSuccessDialog(true); // open success dialog
        } else {
          // If some other success-like status => close
          handleClose();
        }
      }
    );
  };

  const handleYes = () => {
    if (!socket || !notificationToShow) return;
    socket.emit(
      "notification_reply",
      {
        notificationId: notificationToShow.notificationId,
        answer: "yes",
        type: "POA_SIMPLE",
      },
      () => {
        handleClose();
      }
    );
  };

  const handleNo = () => {
    if (!socket || !notificationToShow) return;
    socket.emit(
      "notification_reply",
      {
        notificationId: notificationToShow.notificationId,
        answer: "no",
        type: "POA_SIMPLE",
      },
      () => {
        handleClose();
      }
    );
  };

  const handleClose = () => {
    setNotificationToShow(undefined);
    setTimeLeft(0);
    setPassword("");
    setPasswordError("");
    setHasExceededAttempts(false);
  };

  const closeSuccessDialogAndRedirect = () => {
    setShowSuccessDialog(false);
    if (successEventUuid && !successEventHasPayment) {
      router.push(`/events/${successEventUuid}`);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Render
  // ─────────────────────────────────────────────────────────────────────────────
  const opened = !!notificationToShow;
  const isPoaPassword = notificationToShow?.type === "POA_PASSWORD";

  const dialogTitle = notificationToShow?.title || "NOTIFICATION";
  const formattedTime = timeLeft > 0 ? `(${new Date(timeLeft * 1000).toISOString().slice(14, 19)})` : "(00:00)";

  return (
    <>
      <Dialog
        opened={opened}
        title=""
        className="myDialog max-w-[400px] w-11/12 p-0 mx-auto bg-white bg-opacity-100"
        colors={{ bgIos: "bg-white", bgMaterial: "bg-white" }}
        translucent={false}
        content={
          notificationToShow ? (
            <div className="flex flex-col p-0 text-center space-y-3 relative">
              <h2 className="text-sm font-semibold">{dialogTitle}</h2>
              {isPoaPassword && (
                <>
                  <p className="text-sm font-medium">
                    Enter the event password in <span className="font-semibold">{formattedTime}</span>
                  </p>
                  <p className="text-gray-500 text-xs mt-2">Enter the SBT claim code shared by the organizer.</p>
                  <div className="w-full mt-3">
                    <Input
                      type="password"
                      placeholder="SBT password"
                      className="rounded-md border-0 w-full"
                      value={password}
                      disabled={hasExceededAttempts}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordError("");
                      }}
                    />
                  </div>
                  {passwordError && <p className="text-red-500 text-sm mt-1 text-left">{passwordError}</p>}
                </>
              )}

              {notificationToShow.type === "POA_SIMPLE" && <p className="text-sm">{notificationToShow.desc}</p>}
            </div>
          ) : (
            <div className="p-4">
              <p>Your response has been saved.</p>
            </div>
          )
        }
        buttons={
          notificationToShow ? (
            notificationToShow.type === "POA_SIMPLE" ? (
              <div className="flex justify-end space-x-0 px-0 pb-0 bg-white">
                <DialogButton
                  onClick={(e) => {
                    e.preventDefault();
                    handleNo();
                  }}
                  className="w-1/2"
                >
                  No
                </DialogButton>
                <DialogButton
                  strong
                  onClick={(e) => {
                    e.preventDefault();
                    handleYes();
                  }}
                  className="w-1/2"
                >
                  Yes
                </DialogButton>
              </div>
            ) : (
              // POA_PASSWORD
              <div className="p-0 bg-white w-full flex justify-center">
                <DialogButton
                  strong
                  className="bg-blue-500 text-white text-sm w-full"
                  onClick={(e) => {
                    e.preventDefault();
                    hasExceededAttempts ? handleClose() : handleConfirmPassword();
                  }}
                  disabled={!hasExceededAttempts && !password}
                >
                  {hasExceededAttempts ? "Close" : "Confirm"}
                </DialogButton>
              </div>
            )
          ) : null
        }
      />

      <Dialog
        opened={showSuccessDialog}
        onBackdropClick={() => setShowSuccessDialog(false)}
        title=""
        className="myDialog max-w-[400px] w-11/12 p-0 mx-auto bg-white bg-opacity-100"
        colors={{ bgIos: "bg-white", bgMaterial: "bg-white" }}
        translucent={false}
        content={
          <div className="p-4 text-center">
            {successEventUuid && successEventHasPayment ? (
              <p className="inline-flex text-left text-sm mb-2">
                You have successfully entered the correct password. we will send you the reward link soon.
              </p>
            ) : (
              <p className="inline-flex text-left text-sm mb-2">
                You have entered the correct password. Now you must check the event page to get your SBT reward.
              </p>
            )}

            {successEventUuid && redirectCountdown > 0 && (
              <>
                {successEventHasPayment ? (
                  <p className="text-xs text-gray-600">check your telegram later</p>
                ) : (
                  <p className="text-xs text-gray-600">
                    Redirecting in {redirectCountdown} second
                    {redirectCountdown > 1 ? "s" : ""}...
                  </p>
                )}
              </>
            )}
          </div>
        }
        buttons={
          <div className="flex justify-center bg-white p-0 w-full">
            {successEventUuid ? (
              <DialogButton
                strong
                className="bg-blue-500 text-white text-sm w-full"
                onClick={(e) => {
                  e.preventDefault();
                  closeSuccessDialogAndRedirect();
                }}
              >
                {successEventHasPayment ? "Close" : "Go to Event Page"}
              </DialogButton>
            ) : (
              <DialogButton
                strong
                className="bg-blue-500 text-white w-full"
                onClick={(e) => {
                  e?.preventDefault();
                  setShowSuccessDialog(false);
                }}
              >
                Close
              </DialogButton>
            )}
          </div>
        }
      />
    </>
  );
};

export default NotificationHandler;
