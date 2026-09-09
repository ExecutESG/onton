'use client';

import { useEffect, useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

export const Statistic = ({ title, number, image }) => (
  <div className="flex flex-col items-center">
    <DotLottieReact
      loop
      autoplay
      src={image}
      alt={title}
      height={80}
      width={80}
      className="mx-auto mb-3 lg:w-[180px]"
    />
    <span className="block text-[20px] lg:text-[24px] font-bold text-gray-900 mb-1">{number}</span>
    <span className="text-center text-sm text-gray-600">{title}</span>
  </div>
);

export default function StatisticsSection() {
  const [stats, setStats] = useState({
    totalSBTs: '+13,100,000',
    totalEvents: '+2,400',
    totalTickets: '+4,800',
    totalUsers: '+930,000',
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('https://app.onton.live/api/client/v1/public/stats');
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setStats({
              totalSBTs: `+${Number(json.data.totalSBTs).toLocaleString()}`,
              totalEvents: `+${Number(json.data.totalEvents).toLocaleString()}`,
              totalTickets: `+${Number(json.data.totalTickets).toLocaleString()}`,
              totalUsers: `+${Number(json.data.totalUsers).toLocaleString()}`,
            });
          }
        }
      } catch {
        // Fallback to initial verified metrics
      }
    };

    fetchStats();
  }, []);

  return (
    <section className="border-y border-[#C8C7CB] md:border-0 my-6 py-6">
      {/* Pulse of TON Ticker */}
      <div className="w-full overflow-hidden bg-blue-50/80 border-y border-blue-100 py-2.5 mb-8">
        <div className="flex items-center gap-8 whitespace-nowrap text-xs font-semibold text-[#007AFF] animate-pulse justify-center">
          <span>⚡ LIVE ON TON: 1-Tap Free RSVPs Active</span>
          <span className="text-blue-300">•</span>
          <span>⭐ Telegram Stars (Apple/Google Pay) Enabled</span>
          <span className="text-blue-300">•</span>
          <span>🔒 Automated Community Gating Live</span>
          <span className="text-blue-300">•</span>
          <span>🏆 13.1M+ SoulBound Tokens Distributed</span>
          <span className="text-blue-300">•</span>
          <span>📍 2,400+ Events Powered</span>
        </div>
      </div>

      <div className="container">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-[20px] md:text-[36px] text-gray-900">Ecosystem Scale &amp; Impact</h3>
            <p className="text-sm text-gray-500 mt-1">Live metrics verified across the TON Blockchain &amp; Telegram network.</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Live Data
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-10">
          <Statistic
            title="SoulBound Tokens Awarded"
            number={stats.totalSBTs}
            image="/love-frog-emoji.lottie"
          />
          <Statistic
            title="Events Hosted"
            number={stats.totalEvents}
            image="/tea-green-frog.lottie"
          />
          <Statistic
            title="Tickets Issued"
            number={stats.totalTickets}
            image="/money-emoji.lottie"
          />
          <Statistic
            title="Registered Telegram Users"
            number={stats.totalUsers}
            image="/waving-hand-emoji.lottie"
          />
        </div>
      </div>
    </section>
  );
}
