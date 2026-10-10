import React from "react";
import { Award } from "lucide-react";

export function FoundingOrganizerBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30 whitespace-nowrap shadow-sm ${className}`}
      title="Founding Organizer"
    >
      <Award size={12} className="text-amber-500 shrink-0" />
      <span>Founding Organizer</span>
    </span>
  );
}

export default FoundingOrganizerBadge;
