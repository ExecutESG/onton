'use client';
import Image from 'next/image';
import Link from 'next/link';

export default function CTASection() {
  return (
    <section id='cta' className="container-xl scroll-mt-20">
      <div className="flex flex-col md:flex-row pt-4 gap-8 items-center">

        <div className="md:basis-7/12 md:order-1">
          <Image src={'/onton-landing-1.svg'} alt="" height={760} width={760}/>
        </div>

        <div className="md:basis-5/12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-[#007AFF] mb-4 border border-blue-200 shadow-sm">
            <span>✨</span> The Luma of Telegram & Web3
          </div>
          <h1 className="font-bold text-[34px] mb-2 md:text-[56px] md:mb-4 tracking-tight leading-tight">
            Events on Telegram, Simplified.
          </h1>
          <h2 className="font-semibold text-[20px] md:text-[24px] mb-3 text-gray-700 leading-snug">
            1-Click Free RSVPs · Telegram Stars · Automated Group Gating
          </h2>
          <p className="mb-6 md:mb-8 text-gray-600 text-[16px] leading-relaxed">
            ONTON combines frictionless Telegram native onboarding with powerful Web3 tools. Attendees RSVP in one tap without crypto wallets, pay using Telegram Stars (Apple/Google Pay) or TON/USDT, and instantly unlock your private community chat.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pb-4">
            <Link
              target="_blank"
              href="https://t.me/theontonbot"
              className="flex-grow"
            >
              <button className="btn btn-primary w-full py-3 text-[16px] font-semibold shadow-md hover:shadow-lg transition-all">
                🚀 Launch Mini App
              </button>
            </Link>
            <Link
              target="_blank"
              href="https://t.me/theontonbot/event"
              className="flex-grow"
            >
              <button className="btn btn-light w-full py-3 text-[16px] font-semibold border border-gray-300 hover:bg-gray-50 transition-all">
                🎟️ Host an Event
              </button>
            </Link>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Over 300,000+ Telegram users & 400+ events powered.
          </p>
        </div>
      </div>
    </section>
  )
}
