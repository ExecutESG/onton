import Link from 'next/link';

export default function CaseStudySection() {
  return (
    <section className="py-16 bg-[#F9F9FB] border-b border-gray-200">
      <div className="container">
        <div className="max-w-4xl mx-auto bg-white rounded-3xl p-8 sm:p-12 border border-gray-200 shadow-sm">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 mb-4 border border-emerald-200">
            <span>🏆</span> Proven At Scale
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold text-gray-900 tracking-tight mb-4 leading-tight">
            How Flagship Web3 Conferences &amp; Summits Power Ticketing with ONTON
          </h2>

          <p className="text-gray-600 leading-relaxed text-base sm:text-lg mb-8">
            From regional TON Society hacker houses to global Web3 gatherings, ONTON has eliminated the headache of managing fragmented registration lists, lost ticket emails, and manual Telegram group approvals.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <div className="p-5 rounded-2xl bg-blue-50/70 border border-blue-100">
              <div className="text-2xl sm:text-3xl font-black text-[#007AFF] mb-1">0%</div>
              <div className="text-sm font-semibold text-gray-900 mb-1">Wallet Drop-Off</div>
              <p className="text-xs text-gray-600">Attendees RSVP in 1 tap without mandatory crypto wallet friction or seed phrases.</p>
            </div>

            <div className="p-5 rounded-2xl bg-purple-50/70 border border-purple-100">
              <div className="text-2xl sm:text-3xl font-black text-purple-600 mb-1">100%</div>
              <div className="text-sm font-semibold text-gray-900 mb-1">Spam-Proof Chats</div>
              <p className="text-xs text-gray-600">Automated single-use Telegram invite links prevent unauthorized link leaks and bots.</p>
            </div>

            <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 mb-1">&lt; 3s</div>
              <div className="text-sm font-semibold text-gray-900 mb-1">Door Check-In</div>
              <p className="text-xs text-gray-600">Mobile camera scanner validates tickets instantly, unlocking lazy-minted SBT badges.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-gray-100">
            <div className="text-sm text-gray-600">
              Hosting your own conference or meetup? See how easy it is to launch.
            </div>
            <Link
              href="/blog/guide"
              className="px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-black transition-all"
            >
              Read Organizer Handbook ➔
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
