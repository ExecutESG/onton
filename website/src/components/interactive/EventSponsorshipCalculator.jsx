"use client";

import { useState } from "react";

export default function EventSponsorshipCalculator() {
  const [eventType, setEventType] = useState("mixer"); // mixer, dinner, hackathon, summit
  const [attendees, setAttendees] = useState(200);
  const [tierLevel, setTierLevel] = useState("developer"); // developer, executive, degen

  // Pricing multipliers
  const typeMultiplier = {
    dinner: 2.2,
    hackathon: 1.8,
    mixer: 1.0,
    summit: 2.5,
  }[eventType];

  const tierMultiplier = {
    executive: 2.0,
    developer: 1.4,
    degen: 0.8,
  }[tierLevel];

  const baseTitle = Math.round(attendees * 40 * typeMultiplier * tierMultiplier);
  const titleSponsorship = Math.max(5000, Math.min(50000, Math.round(baseTitle / 500) * 500));
  const supportingSponsorship = Math.round((titleSponsorship * 0.35) / 250) * 250;
  const totalPotential = titleSponsorship + supportingSponsorship * 3;

  return (
    <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-gray-900 text-white rounded-2xl p-6 sm:p-8 border border-indigo-500/30 shadow-2xl my-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-indigo-800/60 pb-6 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 mb-2">
            <span>💰</span> Web3 Sponsorship Calculator
          </div>
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
            How Much Sponsorship Revenue Can Your Event Raise?
          </h3>
          <p className="text-sm text-gray-400">
            Estimate sponsor deck pricing for Token2049, Devcon, ETHDenver, and KBW side events
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-400 block uppercase">Projected Sponsor Yield</span>
          <span className="text-2xl sm:text-3xl font-black text-indigo-400">
            ${totalPotential.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div>
          <label className="text-xs font-semibold text-gray-300 block mb-2">
            Event Format
          </label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-3 text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="mixer">🍸 Happy Hour / Rooftop Mixer (150-400)</option>
            <option value="dinner">🍽️ VIP Founder & Whale Dinner (25-50)</option>
            <option value="hackathon">💻 Hacker House / BUIDL Hub (50-200)</option>
            <option value="summit">🎤 Full-Day Mini Summit (300-800)</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-300 block mb-2">
            Target Attendee Profile
          </label>
          <select
            value={tierLevel}
            onChange={(e) => setTierLevel(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-3 text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="developer">👨‍💻 Core Protocol Developers & CTOs</option>
            <option value="executive">👔 Venture Partners & Founders</option>
            <option value="degen">🚀 Community Traders & Degens</option>
          </select>
        </div>

        <div>
          <div className="flex justify-between text-xs font-semibold mb-2">
            <span className="text-gray-300">Target Attendance</span>
            <span className="text-indigo-400 font-bold">{attendees} Guests</span>
          </div>
          <input
            type="range"
            min="30"
            max="1000"
            step="10"
            value={attendees}
            onChange={(e) => setAttendees(Number(e.target.value))}
            className="w-full accent-indigo-500 cursor-pointer h-2 bg-gray-700 rounded-lg mt-3"
          />
          <div className="flex justify-between text-[11px] text-gray-500 mt-1">
            <span>30</span>
            <span>500</span>
            <span>1,000+</span>
          </div>
        </div>
      </div>

      {/* Recommended Deck Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-slate-800/80 rounded-xl p-4 border border-indigo-500/20">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-bold uppercase text-indigo-400">Title Sponsor Tier</span>
            <span className="text-lg font-bold text-white">${titleSponsorship.toLocaleString()}</span>
          </div>
          <p className="text-xs text-gray-400">
            Includes keynote speaking slot, co-branded Telegram ticket banner, and exclusive VIP lounge table.
          </p>
        </div>

        <div className="bg-slate-800/80 rounded-xl p-4 border border-indigo-500/20">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-bold uppercase text-indigo-400">Supporting Sponsor Tier (x3)</span>
            <span className="text-lg font-bold text-white">${supportingSponsorship.toLocaleString()} each</span>
          </div>
          <p className="text-xs text-gray-400">
            Includes logo on registration page, panel participant seat, and Telegram announcement blast.
          </p>
        </div>
      </div>

      <div className="bg-indigo-950/60 border border-indigo-500/40 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-xs text-indigo-300 font-bold uppercase tracking-wider block">
            Ready to secure sponsors?
          </span>
          <p className="text-xs text-gray-300 mt-0.5">
            ONTON lets you embed co-host sponsor logos directly on attendee Telegram passes and SBT badges.
          </p>
        </div>
        <a
          href="https://t.me/theontonbot/event"
          target="_blank"
          rel="noopener noreferrer"
          className="whitespace-nowrap px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm shadow-lg transition-all"
        >
          Create Event on ONTON →
        </a>
      </div>
    </div>
  );
}
