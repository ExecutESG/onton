"use client";

import { useState } from "react";

export default function EventFeeCalculator() {
  const [ticketPrice, setTicketPrice] = useState(50);
  const [attendees, setAttendees] = useState(250);

  const grossRevenue = ticketPrice * attendees;

  // Eventbrite: 3.7% + $1.79 per ticket + 2.9% payment processing
  const eventbritePlatformFee = grossRevenue * 0.037 + attendees * 1.79;
  const eventbriteProcessing = grossRevenue * 0.029;
  const eventbriteTotal = eventbritePlatformFee + eventbriteProcessing;

  // Luma: 5.0% platform fee + Stripe 2.9% + $0.30 per ticket
  const lumaPlatformFee = grossRevenue * 0.05;
  const lumaProcessing = grossRevenue * 0.029 + attendees * 0.3;
  const lumaTotal = lumaPlatformFee + lumaProcessing;

  // ONTON: 1.5% flat (0% on crypto free RSVPs, max 2% on Stars)
  const ontonTotal = grossRevenue * 0.015;

  const savingsVsLuma = Math.max(0, lumaTotal - ontonTotal);
  const savingsVsEventbrite = Math.max(0, eventbriteTotal - ontonTotal);

  return (
    <div className="bg-gradient-to-br from-gray-900 via-slate-900 to-blue-950 text-white rounded-2xl p-6 sm:p-8 border border-blue-500/20 shadow-2xl my-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-800 pb-6 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-400/30 mb-2">
            <span>⚡</span> Interactive Profit Estimator
          </div>
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
            Web3 Event Fee Comparison Calculator
          </h3>
          <p className="text-sm text-gray-400">
            See how much you save by hosting your event inside Telegram with ONTON
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-400 block">Gross Ticket Volume</span>
          <span className="text-2xl sm:text-3xl font-extrabold text-blue-400">
            ${grossRevenue.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        <div>
          <div className="flex justify-between text-sm font-medium mb-2">
            <span className="text-gray-300">Average Ticket Price</span>
            <span className="text-blue-400 font-bold">${ticketPrice}</span>
          </div>
          <input
            type="range"
            min="0"
            max="300"
            step="5"
            value={ticketPrice}
            onChange={(e) => setTicketPrice(Number(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer h-2 bg-gray-700 rounded-lg"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>$0 (Free RSVP)</span>
            <span>$150</span>
            <span>$300+</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm font-medium mb-2">
            <span className="text-gray-300">Expected Attendees</span>
            <span className="text-blue-400 font-bold">{attendees.toLocaleString()} Guests</span>
          </div>
          <input
            type="range"
            min="20"
            max="1500"
            step="10"
            value={attendees}
            onChange={(e) => setAttendees(Number(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer h-2 bg-gray-700 rounded-lg"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>20</span>
            <span>500</span>
            <span>1,500+</span>
          </div>
        </div>
      </div>

      {/* Platform Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Eventbrite */}
        <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/60">
          <span className="text-xs font-semibold text-gray-400 block mb-1">Legacy Web2</span>
          <h4 className="font-bold text-gray-200">Eventbrite</h4>
          <div className="text-xl font-bold text-red-400 mt-2">
            ${Math.round(eventbriteTotal).toLocaleString()}
          </div>
          <span className="text-xs text-gray-400 block mt-1">
            3.7% + $1.79/ticket + 2.9% stripe
          </span>
        </div>

        {/* Luma */}
        <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/60">
          <span className="text-xs font-semibold text-gray-400 block mb-1">Standard Web3</span>
          <h4 className="font-bold text-gray-200">Luma (lu.ma)</h4>
          <div className="text-xl font-bold text-orange-400 mt-2">
            ${Math.round(lumaTotal).toLocaleString()}
          </div>
          <span className="text-xs text-gray-400 block mt-1">
            5.0% + 2.9% Stripe + $0.30/ticket
          </span>
        </div>

        {/* ONTON */}
        <div className="bg-blue-900/40 rounded-xl p-4 border-2 border-blue-400 relative overflow-hidden shadow-lg">
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500 text-white">
            RECOMMENDED
          </div>
          <span className="text-xs font-semibold text-blue-300 block mb-1">Telegram Native</span>
          <h4 className="font-bold text-white">ONTON OS</h4>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1">
            ${Math.round(ontonTotal).toLocaleString()}
          </div>
          <span className="text-xs text-blue-200 block mt-1">
            ~1.5% Stars / 0% Crypto RSVPs
          </span>
        </div>
      </div>

      {/* Savings Callout */}
      <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-xs text-emerald-400 font-semibold tracking-wider uppercase block">
            Net Organizer Profit Kept
          </span>
          <div className="text-2xl font-black text-emerald-300">
            +${Math.round(savingsVsLuma).toLocaleString()} Extra Savings
          </div>
          <p className="text-xs text-emerald-200/80 mt-0.5">
            vs. Luma, plus zero wallet drop-offs and automated Telegram chat gating.
          </p>
        </div>
        <a
          href="https://t.me/theontonbot/event"
          target="_blank"
          rel="noopener noreferrer"
          className="whitespace-nowrap px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-sm shadow-lg transition-all transform hover:scale-105"
        >
          🎟️ Launch Event on ONTON →
        </a>
      </div>
    </div>
  );
}
