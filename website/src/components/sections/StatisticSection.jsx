'use client';

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
  return (
    <section className="border-y border-[#C8C7CB] md:border-0 my-6 py-6">
      {/* Platform Capabilities & Proof Ticker */}
      <div className="w-full overflow-hidden bg-blue-50/80 border-y border-blue-100 py-2.5 mb-8">
        <div className="flex items-center gap-8 whitespace-nowrap text-xs font-semibold text-[#007AFF] animate-pulse justify-center">
          <span>⚡ 1-Tap Free RSVPs Active</span>
          <span className="text-blue-300">•</span>
          <span>⭐ Telegram Stars &amp; Crypto Enabled</span>
          <span className="text-blue-300">•</span>
          <span>🔒 Automated Community Chat Gating</span>
          <span className="text-blue-300">•</span>
          <span>🏅 332K People with Attendance Credentials</span>
          <span className="text-blue-300">•</span>
          <span>📍 633K Verified In-Person Check-Ins</span>
        </div>
      </div>

      <div className="container">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-[20px] md:text-[36px] text-gray-900">Scale &amp; Verified Attendance</h3>
            <p className="text-sm text-gray-500 mt-1">Verified check-ins and portable credentials across the ONTON network.</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Verified
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-10">
          <Statistic
            title="People with Attendance Credentials"
            number="332K"
            image="/love-frog-emoji.lottie"
          />
          <Statistic
            title="Verified In-Person Check-Ins"
            number="633K"
            image="/tea-green-frog.lottie"
          />
          <Statistic
            title="Free Events"
            number="Free Forever"
            image="/waving-hand-emoji.lottie"
          />
          <Statistic
            title="Ticket Fee (Crypto)"
            number="3%"
            image="/money-emoji.lottie"
          />
        </div>
      </div>
    </section>
  );
}
