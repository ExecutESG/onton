import Image from "next/image";
import Link from "next/link";

const socialMediaIcons = [
  { name: "X", icon: "/icons/x-icon.svg", link: "https://x.com/ontonbot" },
  {
    name: "LinkedIn",
    icon: "/icons/linkedin-icon.svg",
    link: "https://www.linkedin.com/company/ontonlive/",
  },
  {
    name: "Telegram Channel",
    icon: "/icons/telegram-icon.svg",
    link: "https://t.me/ontonlive",
  },
];

const footerLinks = [
  {
    title: "About",
    links: [
      {
        text: "FAQ",
        href: "https://t.me/ontonsupport/22315",
        target: "_blank",
      },
      { text: "Privacy Policy ", href: "/privacy" },
      { text: "Terms of Service", href: "/tos" },
    ],
  },
  {
    title: "Shortcut",
    links: [
      {
        text: "Mini app",
        href: "https://t.me/theontonbot/event",
        target: "_blank",
      },
      {
        text: "TON Society",
        href: "https://society.ton.org/",
        target: "_blank",
      },
      {
        text: "ONton Comunity",
        href: "https://t.me/ontonsupport",
        target: "_blank",
      },
    ],
  },
];

const FooterLink = ({ href, children, target }) => (
  <li>
    <Link href={href} target={target}>
      <span className="text-blue-500 hover:underline cursor-pointer">
        {children}
      </span>
    </Link>
  </li>
);

const FooterLinkSection = ({ title, links }) => (
  <div>
    <h4 className="text-md md:text-lg font-semibold">{title}</h4>
    <ul className="mt-2 space-y-2">
      {links.map((link, index) => (
        <FooterLink key={index} href={link.href} target={link.target}>
          {link.text}
        </FooterLink>
      ))}
    </ul>
  </div>
);

const SocialMediaSection = () => (
  <div className="flex flex-col gap-2 md:block space-y-2">
    <h4 className="text-lg font-semibold">Follow us on:</h4>
    <div className="grid grid-cols-2 gap-2 mx-auto" style={{ gap: "1.625rem" }}>
      {socialMediaIcons.map((icon) => (
        <Link target="_blank" key={icon.name} href={icon.link}>
          <Image
            src={icon.icon}
            alt={icon.name}
            width={32}
            height={32}
            className="cursor-pointer"
          />
        </Link>
      ))}
    </div>
  </div>
);

export default function Footer() {
  return (
    <footer className="container flex justify-between items-start py-10 px-20 mx-auto bg-white border-t border-[#C8C7CB] gap-10 w-full flex-col md:flex-row">
      <div className="flex gap-8">
        <div className="flex flex-col gap-2 md:col-span-1 lg:col-span-1">
          <h1 className="text-md md:text-lg font-semibold text-black">ONTON</h1>
          <p className="text-sm text-gray-600 max-w-md">
            The Luma of Telegram & Web3 Event OS. Frictionless 1-tap Free RSVPs, native Telegram Stars & crypto payments, automated group chat gating, and Proof-of-Attendance badges.
          </p>
          <div className="flex justify-between md:col-span-1 lg:col-span-1">
            {footerLinks.map((section, index) => (
              <FooterLinkSection
                key={index}
                title={section.title}
                links={section.links}
              />
            ))}
            <SocialMediaSection />
          </div>
        </div>
      </div>
      {/* <GetStartedLink /> */}
    </footer>
  );
}
