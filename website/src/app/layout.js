import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "ONTON — Events with Verified Attendance",
  description:
    "Create an event in a minute. Free events are free forever. Verified attendance, built in. 1-tap RSVPs on Telegram and web, verified check-in, portable credentials, and low ticket fees.",
  keywords: [
    "Events with verified attendance",
    "Telegram events",
    "Luma alternative",
    "Event management",
    "Proof of Attendance",
    "Portable credentials",
    "Telegram Stars payments",
    "Telegram Mini App",
    "RSVP Telegram",
  ],
  authors: [{ name: "ONTON Team", url: "https://onton.live" }],
  creator: "ONTON",
  publisher: "ONTON",
  metadataBase: new URL("https://onton.live"),
  openGraph: {
    title: "ONTON — Events with Verified Attendance",
    description:
      "Create an event in a minute. Free events are free forever. Verified attendance, built in. 1-tap RSVPs, Telegram Stars & crypto payments, and portable credentials.",
    url: "https://onton.live",
    siteName: "ONTON",
    images: [
      {
        url: "/onton-landing-1.svg",
        width: 1200,
        height: 630,
        alt: "ONTON — Events with Verified Attendance",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ONTON — Events with Verified Attendance",
    description:
      "Create an event in a minute. Free events are free forever. Verified attendance, built in. 1-tap RSVPs, Telegram Stars & crypto payments, and portable credentials.",
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
