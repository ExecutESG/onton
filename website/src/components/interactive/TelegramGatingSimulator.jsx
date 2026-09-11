"use client";

import { useState } from "react";

export default function TelegramGatingSimulator() {
  const [scenario, setScenario] = useState("paid"); // "paid", "refund", "unauthorized"

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 text-white shadow-xl my-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6 border-b border-slate-800 pb-4">
        <div>
          <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">
            🛡️ Interactive Architecture Demo
          </span>
          <h3 className="text-xl font-bold text-white mt-1">
            Automated Telegram Chat Gating Simulator
          </h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setScenario("paid")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              scenario === "paid"
                ? "bg-blue-600 text-white shadow"
                : "bg-slate-800 text-gray-400 hover:text-white"
            }`}
          >
            ✅ Verified Buyer
          </button>
          <button
            onClick={() => setScenario("refund")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              scenario === "refund"
                ? "bg-amber-600 text-white shadow"
                : "bg-slate-800 text-gray-400 hover:text-white"
            }`}
          >
            ⚠️ Refund Trigger
          </button>
          <button
            onClick={() => setScenario("unauthorized")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              scenario === "unauthorized"
                ? "bg-rose-600 text-white shadow"
                : "bg-slate-800 text-gray-400 hover:text-white"
            }`}
          >
            🚫 Link Leaker
          </button>
        </div>
      </div>

      {/* Dynamic Workflow Visualization */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Step 1 */}
        <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/60 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Step 1</span>
            <h4 className="font-semibold text-sm mt-1 text-slate-200">Attendee Ticket</h4>
            <div className="mt-3">
              {scenario === "paid" && (
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-950/60 px-2 py-1 rounded border border-emerald-500/30">
                  <span>🎟️</span> Paid via Stars
                </span>
              )}
              {scenario === "refund" && (
                <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-medium bg-amber-950/60 px-2 py-1 rounded border border-amber-500/30">
                  <span>💸</span> Refund Processed
                </span>
              )}
              {scenario === "unauthorized" && (
                <span className="inline-flex items-center gap-1.5 text-xs text-rose-400 font-medium bg-rose-950/60 px-2 py-1 rounded border border-rose-500/30">
                  <span>❌</span> No Ticket Found
                </span>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            Mini App checks Telegram UserID against smart contract.
          </p>
        </div>

        {/* Step 2 */}
        <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/60 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Step 2</span>
            <h4 className="font-semibold text-sm mt-1 text-slate-200">SBT Credential</h4>
            <div className="mt-3">
              {scenario === "paid" && (
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-950/60 px-2 py-1 rounded border border-emerald-500/30">
                  <span>🛡️</span> SBT Valid on TON
                </span>
              )}
              {scenario === "refund" && (
                <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-medium bg-amber-950/60 px-2 py-1 rounded border border-amber-500/30">
                  <span>🔥</span> SBT Revoked / Burned
                </span>
              )}
              {scenario === "unauthorized" && (
                <span className="inline-flex items-center gap-1.5 text-xs text-rose-400 font-medium bg-rose-950/60 px-2 py-1 rounded border border-rose-500/30">
                  <span>🚫</span> Wallet Signature Missing
                </span>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            Non-transferable Soulbound credential anchored to wallet.
          </p>
        </div>

        {/* Step 3 */}
        <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/60 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Step 3</span>
            <h4 className="font-semibold text-sm mt-1 text-slate-200">Bot Gating Action</h4>
            <div className="mt-3">
              {scenario === "paid" && (
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-950/60 px-2 py-1 rounded border border-emerald-500/30">
                  <span>⚡</span> Single-Use Link Issued
                </span>
              )}
              {scenario === "refund" && (
                <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-medium bg-amber-950/60 px-2 py-1 rounded border border-amber-500/30">
                  <span>🚪</span> Auto-Kick From Group
                </span>
              )}
              {scenario === "unauthorized" && (
                <span className="inline-flex items-center gap-1.5 text-xs text-rose-400 font-medium bg-rose-950/60 px-2 py-1 rounded border border-rose-500/30">
                  <span>🛑</span> Join Request Blocked
                </span>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            @theontonbot verifies join request in &lt;500ms.
          </p>
        </div>

        {/* Step 4 */}
        <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/60 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Step 4</span>
            <h4 className="font-semibold text-sm mt-1 text-slate-200">Community State</h4>
            <div className="mt-3">
              {scenario === "paid" && (
                <span className="inline-flex items-center gap-1.5 text-xs text-blue-400 font-medium bg-blue-950/60 px-2 py-1 rounded border border-blue-500/30">
                  <span>💬</span> Active In VIP Chat
                </span>
              )}
              {scenario === "refund" && (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-medium bg-slate-950/60 px-2 py-1 rounded border border-slate-700/30">
                  <span>🔒</span> Removed from Group
                </span>
              )}
              {scenario === "unauthorized" && (
                <span className="inline-flex items-center gap-1.5 text-xs text-rose-400 font-medium bg-rose-950/60 px-2 py-1 rounded border border-rose-500/30">
                  <span>🛡️</span> Zero Link Leaks
                </span>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            Zero manual admin overhead for event organizers.
          </p>
        </div>
      </div>
    </div>
  );
}
