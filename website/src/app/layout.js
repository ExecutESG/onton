import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "ONTON — The Luma of Telegram & Web3 Event OS",
  description:
    "Host and attend events effortlessly inside Telegram. 1-tap Free RSVPs without wallet friction, native Telegram Stars & crypto checkout, automated private chat gating, and Proof-of-Attendance badges.",
  keywords: [
    "Telegram events",
    "Luma for Telegram",
    "Web3 events",
    "TON blockchain",
    "Telegram Stars payments",
    "Event management",
    "Proof of Attendance",
    "SBT badges",
    "Telegram Mini App",
    "RSVP Telegram",
  ],
  authors: [{ name: "ONTON Team", url: "https://onton.live" }],
  creator: "ONTON",
  publisher: "ONTON",
  metadataBase: new URL("https://onton.live"),
  openGraph: {
    title: "ONTON — The Luma of Telegram & Web3 Event OS",
    description:
      "Host and attend events effortlessly inside Telegram. 1-tap Free RSVPs, Telegram Stars payments, automated group chat gating, and Proof-of-Attendance badges.",
    url: "https://onton.live",
    siteName: "ONTON",
    images: [
      {
        url: "/onton-landing-1.svg",
        width: 1200,
        height: 630,
        alt: "ONTON — The Luma of Telegram & Web3",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ONTON — The Luma of Telegram & Web3 Event OS",
    description:
      "Host and attend events effortlessly inside Telegram. 1-tap Free RSVPs, Telegram Stars payments, automated group gating, and Proof-of-Attendance badges.",
    creator: "@ontonbot",
    images: ["/onton-landing-1.svg"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
