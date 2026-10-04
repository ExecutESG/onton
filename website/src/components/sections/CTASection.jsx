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
            <span>✨</span> Events with Verified Attendance
          </div>
          <h1 className="font-bold text-[34px] mb-2 md:text-[56px] md:mb-4 tracking-tight leading-tight">
            Create an event in a minute.
          </h1>
          <h2 className="font-semibold text-[20px] md:text-[24px] mb-3 text-gray-700 leading-snug">
            Free events are free forever. Verified attendance, built in.
          </h2>
          <p className="mb-6 md:mb-8 text-gray-600 text-[16px] leading-relaxed">
            Free organizer onboarding, 1-tap RSVPs without wallet requirements, automated chat gating, and fast door check-in. Sell tickets with Telegram Stars or crypto (3% fee) and issue portable credentials attendees keep forever.
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
            332K people with attendance credentials · 633K verified in-person check-ins.
          </p>
        </div>
      </div>
    </section>
  )
}
