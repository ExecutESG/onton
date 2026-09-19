import Typography from "../../components/Typography";

interface GlossaryTerm {
  term: string;
  category: string;
  definition: string;
}

const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    term: "ONION Points",
    category: "Ecosystem Rewards",
    definition:
      "Engagement loyalty points earned across the ONTON ecosystem by attending events, hosting gatherings, completing quests, and climbing tournament leaderboards.",
  },
  {
    term: "Soulbound Token (SBT) / POA",
    category: "Web3 Credentials",
    definition:
      "Proof of Attendance tokens minted directly on the TON blockchain to an attendee's wallet address. SBTs cannot be transferred or sold, serving as a permanent badge of presence.",
  },
  {
    term: "TonConnect",
    category: "Web3 Authentication",
    definition:
      "The official decentralized wallet connection standard for The Open Network (TON), allowing seamless interaction with Tonkeeper, MyTonWallet, OpenMask, and Telegram Wallet.",
  },
  {
    term: "Play2Win Tournaments",
    category: "Gaming",
    definition:
      "Competitive, time-bounded gaming contests hosted inside the ONTON ecosystem where top participants win cryptocurrency prizes, SBTs, and leaderboard rank multipliers.",
  },
  {
    term: "Raffles & Giveaways",
    category: "Event Management",
    definition:
      "On-chain and cryptographically verifiable prize draws initiated by event organizers for verified attendees during or after an event.",
  },
  {
    term: "Organizer Channel",
    category: "Community Hub",
    definition:
      "A dedicated organizer profile page aggregating published events, subscriber communities, past attendance metrics, and social handles.",
  },
  {
    term: "Check-in Officer",
    category: "Roles & Permissions",
    definition:
      "A delegated team member permitted to scan attendee QR codes and confirm entry passes without having financial or administrative rights over the event.",
  },
  {
    term: "Co-Organizer Admin",
    category: "Roles & Permissions",
    definition:
      "A collaborator granted comprehensive administrative permissions over an event, including ticket tier adjustments, guest management, and analytics.",
  },
];

export default function GlossaryPage() {
  return (
    <div className="flex flex-col max-w-xl mx-auto px-4 py-8 pb-32">
      <div className="mb-6 text-center">
        <Typography variant="title1" weight="bold" className="text-slate-900 dark:text-white">
          ONTON Glossary
        </Typography>
        <Typography variant="caption1" className="text-slate-500 dark:text-slate-400 mt-1">
          Key terms and concepts powering the ONTON Web3 event ecosystem
        </Typography>
      </div>

      <div className="flex flex-col gap-4">
        {GLOSSARY_TERMS.map((item) => (
          <div
            key={item.term}
            className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition hover:border-cyan-500/50"
          >
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
              <Typography variant="headline" weight="bold" className="text-slate-900 dark:text-white">
                {item.term}
              </Typography>
              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                {item.category}
              </span>
            </div>
            <Typography variant="footnote" className="text-slate-600 dark:text-slate-300 leading-relaxed">
              {item.definition}
            </Typography>
          </div>
        ))}
      </div>
    </div>
  );
}
