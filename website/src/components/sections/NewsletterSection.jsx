'use client';

import { useState } from 'react';

export default function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
  };

  return (
    <section className="py-16 bg-white border-b border-gray-200">
      <div className="container">
        <div className="max-w-3xl mx-auto text-center px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#007AFF] mb-3">
            📬 Organizer Dispatch
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-3">
            Stay Ahead of the Telegram &amp; Web3 Event Curve
          </h2>
          <p className="text-gray-600 text-sm sm:text-base mb-6 max-w-xl mx-auto">
            Get bi-weekly event growth tactics, Telegram Mini App updates, and early access to new ONTON features.
          </p>

          {submitted ? (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm max-w-md mx-auto">
              🎉 <strong>Thank you for subscribing!</strong> Join our{' '}
              <a
                href="https://t.me/ontonsupport"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-emerald-900"
              >
                Organizer Telegram Community
              </a>{' '}
              for instant updates and direct support.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                required
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:border-transparent"
              />
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-[#007AFF] text-white text-sm font-semibold hover:bg-blue-600 transition-all shadow-sm"
              >
                Subscribe
              </button>
            </form>
          )}

          <p className="text-xs text-gray-400 mt-3">No spam ever. Unsubscribe anytime.</p>
        </div>
      </div>
    </section>
  );
}
