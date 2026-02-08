/* components/Tasks/ConnectTaskCard.tsx */
"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReactElement } from "react";

interface ConnectTaskCardProps {
  title: string;
  description: string | null; // normal description
  pointsLabel: string;
  icon: ReactElement;
  done: boolean;
  loading?: boolean;
  disabled?: boolean; // ◀︎ new
  hintWhenLocked?: string; // ◀︎ new
  onGo?: () => void;
}

export default function ConnectTaskCard({
  title,
  description,
  pointsLabel,
  icon,
  done,
  loading,
  disabled,
  hintWhenLocked,
  onGo,
}: ConnectTaskCardProps) {
  /* decide what small line to show */
  const smallLine = disabled && hintWhenLocked ? hintWhenLocked : (description ?? pointsLabel);

  return (
    <div
      className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3 opacity-100 mb-4
                    transition-opacity duration-200"
      style={{ opacity: disabled && !done ? 0.7 : 1 }}
    >
      {/* left */}
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 min-w-14 items-center justify-center rounded-full bg-gray-100 text-3xl text-primary">
          {icon}
        </div>
        <div className="flex flex-col">
          <span className="font-medium">{title}</span>
          <span className="text-sm text-gray-500">{smallLine}</span>
        </div>
      </div>

      {/* right */}
      <Button
        size="sm"
        className={cn(
          "min-w-[82px] rounded-lg border-2",
          done ? "pointer-events-none border-green-500 bg-green-500 text-white" : "border-primary text-primary"
        )}
        variant="ghost"
        disabled={done || loading || disabled}
        onClick={!done && !loading && !disabled ? onGo : undefined}
      >
        {done ? "Done" : loading ? "Loading…" : disabled ? "Locked" : "Go"}
      </Button>
    </div>
  );
}
