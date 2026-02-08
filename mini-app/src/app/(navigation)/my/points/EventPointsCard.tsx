"use client";
import { Badge } from "@/components/ui/badge";
import { UsersScoreActivityType } from "@/db/schema";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

interface EventPointsCardProps {
  eventTitle: string; // e.g. "Attend paid online events"
  tasksCount: number; // e.g. 3
  description: string; // e.g. "10 Points + 1 Point per USDT price"
  totalPoints: number; // e.g. 112
  type?: UsersScoreActivityType;
}

export default function EventPointsCard({ eventTitle, tasksCount, description, totalPoints, type }: EventPointsCardProps) {
  return (
    <div className="border border-brand-divider-dark rounded-2lg p-3 mb-3 flex  justify-between items-center">
      <div>
        <div className="flex justify-between items-center">
          {/* Event title and tasks (e.g. "Attend paid online events x3") */}
          <div className="text-sm font-medium">
            {eventTitle}
            {/* <span className="text-xs font-normal text-gray-500">x{tasksCount}</span> */}
          </div>
        </div>

        {/* Secondary description line (e.g. "10 Points + 1 Point per USDT price") */}
        <p className="text-xs text-gray-600 mt-1">{description}</p>
      </div>

      {/* Black circle showing total points (right side) */}
      <div className="flex items-center gap-1.5">
        <Badge variant="outline">{totalPoints}</Badge>
        {type && (
          <Link
            href={`/my/points/${type}/details`}
            className="text-primary"
          >
            <ChevronRight
              size={20}
              strokeWidth={3}
            />
          </Link>
        )}
      </div>
    </div>
  );
}
