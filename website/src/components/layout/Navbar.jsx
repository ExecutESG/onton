"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import BarsIcon from "../icon/BarsIcon";
import TelegramIcon from "../icon/TelegramIcon";

const NavbarLink = ({ href, label, target }) => {
  const [isActive, setIsActive] = useState(false);
  const pathname = usePathname();
  const [hash, setHash] = useState("");

  useEffect(() => {
    // Function to update hash
    const updateHash = () => setHash(window.location.hash);

    // Initial hash
    updateHash();

    // Listen for hash changes
    window.addEventListener("hashchange", updateHash);

    // Cleanup
    return () => window.removeEventListener("hashchange", updateHash);
  }, [hash, pathname]);

  useEffect(() => {
    if (pathname === "/") {
      if (hash === "" && href === "/#cta") {
        setIsActive(true);
      } else {
        setIsActive(`/${hash}` === href);
      }
    } else {
      setIsActive(pathname === href);
    }
  }, [pathname, hash, href]);

  return (
    <li className="relative">
      <Link
        href={href}
        className={`block py-2 px-3 rounded md:p-0 ${isActive ? "text-white bg-primary md:bg-transparent md:text-primary" : "text-[#8E8E93] hover:bg-gray-100 md:hover:bg-transparent md:hover:text-primary"}`}
        target={target}
      >
        {label}
        {isActive && (
          <div className="absolute bg-primary h-[3px] right-0 left-0 -bottom-4 rounded-t-lg hidden md:block"></div>
        )}
      </Link>
    </li>
  );
};

const navItems = [
  {
    label: "Home",
    href: "/#cta",
  },
  {
    label: "Organizer Guide",
    href: "https://onton.live/blog/guide/",
    target: "_blank",
  },
  {
    label: "Mini app",
    href: "/#features",
  },
];

export default function Navbar() {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <>
      <header className="h-[62px]">
        <nav className="fixed w-full z-20 top-0 start-0 border-b border-gray-200 backdrop-blur-xl bg-white/60">
          <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto container py-4">
            <button
              type="button"
              className="inline-flex items-center p-2 w-10 h-10 justify-center text-sm text-gray-500 rounded-lg md:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200"
              aria-controls="navbar-sticky"
              onClick={() => setShowMenu(!showMenu)}
            >
              <span className="sr-only">Open main menu</span>
              <BarsIcon className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 md:order-2 text-primary">
              <Link
                target="_blank"
                href="https://t.me/theontonbot/event"
                className="hidden sm:inline-flex items-center justify-center px-3.5 py-1.5 text-xs font-semibold rounded-full bg-[#007AFF] text-white hover:bg-blue-600 transition-all shadow-sm"
              >
                🎟️ Host Event
              </Link>
              <Link
                target="_blank"
                href="https://t.me/ontonlive"
                className="flex space-x-1.5 items-center"
              >
                <TelegramIcon />
                <span className="font-bold hidden md:block">Channel</span>
              </Link>
            </div>

            <div
              className={`items-center justify-between w-full md:flex md:w-auto md-order-1 ${showMenu ? "" : "hidden"}`}
              id="navbar-sticky"
            >
              <ul className="flex flex-col p-4 md:p-0 mt-4 font-medium border border-[C8C7CB] rounded-lg bg-gray-50 md:space-x-8 md:flex-row md:mt-0 md:border-0 md:bg-transparent">
                {navItems.map((item) => (
                  <NavbarLink
                    key={item.label}
                    href={item.href}
                    label={item.label}
                    target={item.target}
                  />
                ))}
              </ul>
            </div>
          </div>
        </nav>
      </header>
    </>
  );
}
