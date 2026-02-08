"use client";
import React from "react";

interface EventPointsGroupProps {
  title: string;
  /** Any number of <EventPointsCard> children */
  children: React.ReactNode;
}

export default function EventPointsGroup({ title, children }: EventPointsGroupProps) {
  return (
    <div className="bg-white rounded-lg h-auto px-2 ">
      {/* Group title, e.g. "Online Events" or "Offline Events" */}
      <h2 className="text-base font-semibold m-2">{title}</h2>
      {/* Render EventPointsCard children here */}
      {children}
    </div>
  );
}
