"use client";

import React from "react";
import { useLoginStore } from "@/context/store/login.store";
import { Lock } from "lucide-react";

export default function LoginRequired() {
  const { openLogin } = useLoginStore();

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center max-w-sm mx-auto">
      <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6 animate-pulse">
        <Lock className="w-8 h-8" />
      </div>

      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
        Unlock your Profile
      </h2>
      
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Sign in to view your tickets, check hosted events, and track your ONION points.
      </p>

      <button
        onClick={openLogin}
        className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-3 px-6 rounded-xl shadow-md transition-all active:scale-[0.98] text-sm"
      >
        Sign In to ONTON
      </button>
    </div>
  );
}
