import Link from 'next/link';

const Card = ({ title, description, link, linkText, disabled }) => (
  <div className="bg-[#E5F2FF] rounded-[8px] p-[12px] min-h-[116px] md:p-[24px] md:min-h-[144px] flex flex-col justify-between">
    <div>
      <h4 className="text-[15px] mb-[12px] font-medium md:text-[20px] md:mb-[16px]">
        {title}
      </h4>
      <p className="text-[15px] md:text-[17px]">
        {description}
      </p>
    </div>
    {disabled ? (
      <span className="text-gray-500 italic mt-2">Coming soon</span>
    ) : (
      <Link href={link} className="text-blue-600 hover:underline mt-2">
        {linkText || "Learn more"}
      </Link>
    )}
  </div>
);

const cards = [
  {
    title: "1. Create in 60 Seconds",
    description: "Launch your event directly on Telegram. Enable Free RSVP, accept Telegram Stars (Apple/Google Pay) or TON/USDT, and connect your official group.",
    link: "https://t.me/theontonbot/event",
    linkText: "Host an Event →"
  },
  {
    title: "2. 1-Click Frictionless RSVP",
    description: "Attendees register instantly without crypto wallet setups or gas fees. They receive a personal QR pass and immediate one-time group chat access.",
    link: "https://t.me/theontonbot",
    linkText: "Explore Events →"
  },
  {
    title: "3. Door Check-in & Badges",
    description: "Scan attendee QR codes at the door with the fast mobile scanner. Check-in automatically unlocks verified digital Proof-of-Attendance SBT badges.",
    link: "https://t.me/ontonlive",
    linkText: "Join Community →"
  }
];

export default function HowItWorksSection() {
  return (
    <section id='how-it-works' className="container mb-10 md:mb-20 scroll-mt-20">
      <h3 className="font-semibold text-[20px] md:text-[36px] mb-5">
        How It Works
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card, index) => (
          <Card key={index} {...card} />
        ))}
      </div>
    </section>
  );
}
