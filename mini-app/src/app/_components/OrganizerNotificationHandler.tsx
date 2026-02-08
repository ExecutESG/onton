"use client";

import { NotificationItemType, NotificationStatus, NotificationType } from "@/db/schema";
import useNotificationStore from "@/zustand/useNotificationStore";
import { Badge, Button, Dialog, List, ListItem } from "konsta/react";
import React, { useEffect, useState } from "react";

type OrganizerNotification = {
  notificationId: string;
  userId: number;
  type: NotificationType;
  title: string;
  desc: string;
  actionTimeout: number | string;
  additionalData: {
    participant_id?: number;
    event_id?: number;
    poa_id?: string;
    notification_id?: number;
  };
  priority: number;
  itemId: string;
  item_type: NotificationItemType;
  status: NotificationStatus;
  createdAt: string;
  expiresAt: string;
  id: string;
};

const OrganizerNotificationHandler: React.FC = () => {
  const notifications = useNotificationStore((state) => state.notifications);

  const [poaCreatedCount, setPoaCreatedCount] = useState<number>(0);
  const [poaSentCount, setPoaSentCount] = useState<number>(0);
  const [userAnswerPoaCount, setUserAnswerPoaCount] = useState<number>(0);

  const [handledPoaCreationIds, setHandledPoaCreationIds] = useState<Set<string>>(new Set());
  const [handledPoaSentIds, setHandledPoaSentIds] = useState<Set<string>>(new Set());
  const [handledUserAnswerPoaIds, setHandledUserAnswerPoaIds] = useState<Set<string>>(new Set());

  const [dialogOpen, setDialogOpen] = useState<boolean>(false);

  useEffect(() => {
    console.log("Checking for new POA_CREATION_FOR_ORGANIZER notifications...");
    const newPoaCreations = notifications.filter(
      (n) => n.type === "POA_CREATION_FOR_ORGANIZER" && !handledPoaCreationIds.has(n.notificationId)
    );

    if (newPoaCreations.length > 0) {
      console.log(`Found ${newPoaCreations.length} new POA_CREATION_FOR_ORGANIZER notifications.`);
      setPoaCreatedCount((prev) => prev + newPoaCreations.length);

      const newHandledIds = new Set(handledPoaCreationIds);
      newPoaCreations.forEach((n) => newHandledIds.add(n.notificationId));
      setHandledPoaCreationIds(newHandledIds);

      // Show the dialog when new POA creation notifications arrive
      setDialogOpen(true);
    } else {
      console.log("No new POA_CREATION_FOR_ORGANIZER notifications found.");
    }
  }, [notifications, handledPoaCreationIds]);

  useEffect(() => {
    console.log("Checking for new USER_RECEIVED_POA notifications...");
    const newPoaSent = notifications.filter(
      (n) => n.type === "USER_RECEIVED_POA" && !handledPoaSentIds.has(n.notificationId)
    );

    if (newPoaSent.length > 0) {
      console.log(`Found ${newPoaSent.length} new USER_RECEIVED_POA notifications.`);
      setPoaSentCount((prev) => prev + newPoaSent.length);

      const newHandledIds = new Set(handledPoaSentIds);
      newPoaSent.forEach((n) => newHandledIds.add(n.notificationId));
      setHandledPoaSentIds(newHandledIds);
    } else {
      console.log("No new USER_RECEIVED_POA notifications found.");
    }
  }, [notifications, handledPoaSentIds]);

  useEffect(() => {
    console.log("Checking for new USER_ANSWER_POA notifications...");
    const newUserAnswerPoa = notifications.filter(
      (n) => n.type === "USER_ANSWER_POA" && !handledUserAnswerPoaIds.has(n.notificationId)
    );

    if (newUserAnswerPoa.length > 0) {
      console.log(`Found ${newUserAnswerPoa.length} new USER_ANSWER_POA notifications.`);
      setUserAnswerPoaCount((prev) => prev + newUserAnswerPoa.length);

      const newHandledIds = new Set(handledUserAnswerPoaIds);
      newUserAnswerPoa.forEach((n) => newHandledIds.add(n.notificationId));
      setHandledUserAnswerPoaIds(newHandledIds);
    } else {
      console.log("No new USER_ANSWER_POA notifications found.");
    }
  }, [notifications, handledUserAnswerPoaIds]);

  const handleCloseDialog = () => {
    // Reset counts when dialog closes
    setPoaCreatedCount(0);
    setPoaSentCount(0);
    setUserAnswerPoaCount(0);

    // Optionally reset handled IDs if you want to handle future notifications again

    setDialogOpen(false);
  };

  return (
    <Dialog
      opened={dialogOpen}
      onBackdropClick={handleCloseDialog}
      title="Attendance Summary"
      className="z-50 myDialog max-w-[400px] w-11/12 p-0 mx-auto bg-white bg-opacity-100"
      colors={{ bgIos: "bg-white", bgMaterial: "bg-white" }}
      translucent={false}
    >
      <List
        className={"p-0 my-0"}
        dividers={false}
      >
        {/* If you want to show POAs Created again, just uncomment below */}
        {/* <ListItem>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <strong>POAs Created</strong>
            <Badge color="primary">{poaCreatedCount}</Badge>
          </div>
        </ListItem> */}
        <ListItem className={"p-0"}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <strong>Sent to Users</strong>
            <Badge color="secondary">{poaSentCount}</Badge>
          </div>
        </ListItem>
        <ListItem>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <strong>User Answers</strong>
            <Badge color="warning">{userAnswerPoaCount}</Badge>
          </div>
        </ListItem>
      </List>

      <div style={{ marginTop: "1rem", textAlign: "right" }}>
        <Button
          onClick={(e) => {
            e.preventDefault();
            handleCloseDialog();
          }}
        >
          Close
        </Button>
      </div>
    </Dialog>
  );
};

export default OrganizerNotificationHandler;
