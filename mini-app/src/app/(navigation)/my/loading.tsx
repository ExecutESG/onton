"use client";
import { Card } from "konsta/react";

export default function Loading() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      {/* Skeleton for organizer/inline card */}
      <Card className="border border-[#007AFF] w-full !m-0 p-4">
        <div className="h-6 bg-gray-300 rounded w-1/3 mb-2" />
        <div className="h-4 bg-gray-300 rounded w-2/3 mb-2" />
        <div className="h-4 bg-gray-300 rounded w-full" />
      </Card>
      {/* Skeleton for ActionCards */}
      <div className="grid grid-cols-1 gap-4">
        {[1, 2, 3].map((_, idx) => (
          <Card
            key={idx}
            className="p-4"
          >
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gray-300 rounded mr-4" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-300 rounded w-1/2" />
                <div className="h-3 bg-gray-300 rounded w-1/3" />
              </div>
            </div>
          </Card>
        ))}
      </div>
      {/* Skeleton for ConnectWalletCard */}
      <Card className="p-4">
        <div className="h-8 bg-gray-300 rounded mb-2" />
        <div className="h-4 bg-gray-300 rounded" />
      </Card>
    </div>
  );
}
