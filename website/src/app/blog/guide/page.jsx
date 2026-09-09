import Link from "next/link";

export const metadata = {
  title: "Organizer Guide — How to Host Events on ONTON & Telegram",
  description:
    "The complete step-by-step guide for hosting events with ONTON: free 1-click RSVPs, Telegram Stars & crypto ticketing, automated group gating, and QR check-in.",
  openGraph: {
    title: "ONTON Organizer Guide — Events on Telegram, Simplified",
    description:
      "Learn how to launch events, collect payments in Telegram Stars or TON/USDT, gate private community chats, and verify tickets at the door.",
    type: "article",
  },
};

export default function OrganizerGuidePage() {
  return (
    <div className="min-h-screen bg-[#F9F9FB] text-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/" className="hover:text-blue-600 transition-colors">
            Home
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Organizer Guide</span>
        </nav>

        {/* Header Section */}
        <header className="mb-12 border-b border-gray-200 pb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-[#007AFF] mb-4 border border-blue-200 shadow-sm">
            <span>📚</span> Official Organizer Handbook
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900 mb-4 leading-tight">
            How to Host Events on Telegram with ONTON
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 leading-relaxed mb-6">
            A comprehensive, step-by-step handbook to help organizers launch events, collect payments via Telegram Stars &amp; Crypto, automate private group access, and verify attendees at the door.
          </p>

          {/* Quick CTA banner */}
          <div className="flex flex-wrap gap-3 items-center pt-2">
            <a
              href="https://t.me/theontonbot/event"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#007AFF] text-white font-semibold hover:bg-blue-600 transition-all shadow-sm"
            >
              <span>🎟️</span> Launch Event Creator
            </a>
            <a
              href="https://t.me/theontonbot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-all shadow-sm"
            >
              <span>🤖</span> Open Bot (@theontonbot)
            </a>
            <a
              href="https://t.me/ontonsupport"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-gray-600 font-medium hover:text-[#007AFF] transition-all"
            >
              <span>💬</span> Get Support
            </a>
          </div>
        </header>

        {/* Content Body */}
        <div className="space-y-12">
          {/* Section 1: Introduction */}
          <section className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>🌟</span> 1. What is ONTON?
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              ONTON is <strong>The Luma of Telegram &amp; Web3</strong>. Designed specifically for community builders, conference organizers, meetups, and decentralized projects, ONTON combines the frictionless convenience of Telegram with the security and sovereign ownership of Web3.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100">
                <div className="text-xl mb-1">⚡ 1-Tap RSVPs</div>
                <p className="text-xs text-gray-600">Attendees sign up instantly using their Telegram profile. No wallet setup required for free events.</p>
              </div>
              <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-100">
                <div className="text-xl mb-1">💳 Dual-Rail Checkout</div>
                <p className="text-xs text-gray-600">Accept Telegram Stars (Apple/Google Pay) for mainstream users and TON/USDT for Web3 natives.</p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100">
                <div className="text-xl mb-1">🔒 Auto Group Gating</div>
                <p className="text-xs text-gray-600">Automatic single-use Telegram group invite links sent via bot DM to verified attendees.</p>
              </div>
            </div>
          </section>

          {/* Section 2: Creating an Event */}
          <section className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>🚀</span> 2. Creating Your Event in Under 2 Minutes
            </h2>
            <p className="text-gray-600 leading-relaxed mb-6">
              You can configure and publish an event entirely within Telegram or via the Web dashboard.
            </p>

            <ol className="space-y-4 text-gray-700">
              <li className="flex gap-4 items-start">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-[#007AFF] font-bold flex items-center justify-center text-sm">1</span>
                <div>
                  <strong className="text-gray-900">Open the Event Creator Mini App</strong>
                  <p className="text-sm text-gray-600 mt-1">
                    Send <code className="bg-gray-100 px-2 py-0.5 rounded text-blue-600">/start</code> to <a href="https://t.me/theontonbot" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">@theontonbot</a>, or open <a href="https://t.me/theontonbot/event" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">t.me/theontonbot/event</a> directly.
                  </p>
                </div>
              </li>
              <li className="flex gap-4 items-start">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-[#007AFF] font-bold flex items-center justify-center text-sm">2</span>
                <div>
                  <strong className="text-gray-900">Fill in the Event Details</strong>
                  <p className="text-sm text-gray-600 mt-1">
                    Enter the event title, start and end dates/times, a high-resolution banner image, and the venue location (or online link).
                  </p>
                </div>
              </li>
              <li className="flex gap-4 items-start">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-[#007AFF] font-bold flex items-center justify-center text-sm">3</span>
                <div>
                  <strong className="text-gray-900">Select Pricing &amp; Capacity</strong>
                  <p className="text-sm text-gray-600 mt-1">
                    Set whether your event is Free (RSVP mode) or Paid, and define your maximum attendee limit.
                  </p>
                </div>
              </li>
              <li className="flex gap-4 items-start">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-[#007AFF] font-bold flex items-center justify-center text-sm">4</span>
                <div>
                  <strong className="text-gray-900">Publish &amp; Share</strong>
                  <p className="text-sm text-gray-600 mt-1">
                    Tap <strong>Publish</strong>. ONTON generates an instant deep-link (<code className="bg-gray-100 px-2 py-0.5 rounded text-blue-600">t.me/theontonbot?start=event_ID</code>) ready to share across Telegram chats, channels, and socials.
                  </p>
                </div>
              </li>
            </ol>
          </section>

          {/* Section 3: Ticketing Modes */}
          <section className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>🎟️</span> 3. Free RSVPs vs. Paid Ticketing
            </h2>
            <p className="text-gray-600 leading-relaxed mb-6">
              ONTON supports both zero-friction community gatherings and commercial conferences:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-gray-200 rounded-xl p-5 hover:border-blue-300 transition-colors">
                <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 mb-3">
                  Option A: Free RSVP (Zero Friction)
                </div>
                <h3 className="font-bold text-lg text-gray-900 mb-2">1-Click Attendance</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Best for community meetups, webinars, AMAs, and hackathons.
                </p>
                <ul className="text-sm text-gray-600 space-y-1.5 list-disc list-inside">
                  <li>No crypto wallet required.</li>
                  <li>Instant confirmation in Telegram.</li>
                  <li>Generates verifiable mobile QR entrance pass.</li>
                  <li>Maximum registration conversion.</li>
                </ul>
              </div>

              <div className="border border-gray-200 rounded-xl p-5 hover:border-blue-300 transition-colors">
                <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 mb-3">
                  Option B: Paid Tickets (Dual Rail)
                </div>
                <h3 className="font-bold text-lg text-gray-900 mb-2">Stars &amp; Crypto Checkout</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Best for summits, VIP dinners, masterclasses, and ticketed parties.
                </p>
                <ul className="text-sm text-gray-600 space-y-1.5 list-disc list-inside">
                  <li><strong>⭐ Telegram Stars:</strong> In-app payment with Apple Pay / Google Pay.</li>
                  <li><strong>💎 Crypto:</strong> TON or USDT Jettons via TonConnect.</li>
                  <li>Direct payout to organizer wallet.</li>
                  <li>Fraud-proof digital passes.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 4: Automated Group Gating */}
          <section className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>🔒</span> 4. Automated Telegram Group Gating
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Turn your event into an active, exclusive community. Automatically grant verified attendees entry into your private Telegram group or channel while keeping out spammers and bots.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6 text-sm text-amber-900">
              <strong className="block font-semibold mb-1">⚙️ How to set up group gating:</strong>
              <ol className="list-decimal list-inside space-y-1.5 text-amber-800 mt-2">
                <li>Create your private Telegram group or channel for attendees.</li>
                <li>Add <strong className="font-semibold text-amber-950">@theontonbot</strong> to your group as an <strong>Administrator</strong>.</li>
                <li>Ensure the bot has the permission: <code className="bg-amber-100 px-1.5 py-0.5 rounded">Invite Users via Link</code>.</li>
                <li>In your event settings on ONTON, link your Telegram Group ID or invite link.</li>
              </ol>
            </div>

            <p className="text-sm text-gray-600">
              When an attendee RSVPs or completes payment, ONTON immediately creates a secure, single-use invite link (<code className="bg-gray-100 px-1.5 py-0.5 rounded text-blue-600">createChatInviteLink</code>) and sends it directly to their Telegram private chat. Each link expires once clicked, preventing unauthorized link forwarding.
            </p>
          </section>

          {/* Section 5: QR Door Check-in & Scanner */}
          <section className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>📱</span> 5. Door QR Check-In &amp; Entry Scanner
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Eliminate paper guest lists and slow check-in lines. Every attendee receives a unique QR code pass inside their ONTON ticket.
            </p>

            <div className="space-y-3 text-sm text-gray-700">
              <div className="flex gap-3 items-start">
                <span className="text-[#007AFF] font-bold">✓</span>
                <div>
                  <strong>Mobile Camera Scanner:</strong> Organizers and venue staff can scan tickets directly using their smartphone camera inside the ONTON Organizer Mini App.
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <span className="text-[#007AFF] font-bold">✓</span>
                <div>
                  <strong>Instant Validation:</strong> Tickets change from <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-semibold">Active</span> to <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-xs font-semibold">Checked In</span> in real time.
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <span className="text-[#007AFF] font-bold">✓</span>
                <div>
                  <strong>Duplicate Prevention:</strong> If a ticket is scanned twice, the system alerts the staff immediately to prevent unauthorized duplicate entry.
                </div>
              </div>
            </div>
          </section>

          {/* Section 6: Proof of Attendance (SBT Badges) */}
          <section className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>🏅</span> 6. Proof of Attendance &amp; SoulBound Tokens (SBT)
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Reward your loyal attendees with non-transferable on-chain SoulBound Tokens (SBTs) on TON.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              ONTON employs a <strong>Lazy Minting</strong> architecture: organizers do not have to pay gas fees upfront for every registrant. Only attendees who physically check in at the venue unlock the right to claim their commemorative badge, providing genuine proof of real-world participation.
            </p>
          </section>

          {/* Section 7: Viral Growth Loops */}
          <section className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>🚀</span> 7. Viral Growth &amp; Promotion Playbook
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Every ticket issued on ONTON features an <strong>&ldquo;Invite Friends &amp; Earn Points&rdquo;</strong> button. Attendees can share pre-populated Telegram cards directly into their group chats and channels.
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm">
              <strong className="block text-gray-900 mb-2 font-semibold">💡 Tips for Maximizing Attendance:</strong>
              <ul className="space-y-1.5 list-disc list-inside text-gray-600">
                <li>Pin your ONTON event link in your announcement channel.</li>
                <li>Add the event button to your Telegram Bot menu commands.</li>
                <li>Incentivize referrals by giving community perks or VIP badges to top inviters.</li>
                <li>Post reminder messages 24 hours and 2 hours before the event starts.</li>
              </ul>
            </div>
          </section>

          {/* Section 8: Support & Community */}
          <section className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white shadow-lg">
            <h2 className="text-2xl font-bold mb-3">Ready to Host Your Next Event?</h2>
            <p className="text-blue-100 mb-6 leading-relaxed">
              Join hundreds of organizers who power their events with ONTON. If you need custom integration, co-marketing support, or ticketing advice, our core team is available in Telegram.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="https://t.me/theontonbot/event"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 rounded-xl bg-white text-blue-600 font-bold hover:bg-blue-50 transition-all shadow-sm"
              >
                🎟️ Create Your Event Now
              </a>
              <a
                href="https://t.me/ontonsupport"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/20 transition-all"
              >
                💬 Join Organizer Support Group
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
