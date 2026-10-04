import Link from "next/link";
import { GetStartedLink } from "../GetstartedLink";

export default function GetStarted() {
  return (
    <section className="bg-white py-4 md:py-12 border-t-8 border-[#EFEFF4]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="md:flex md:gap-10 md:items-center md:justify-between">
          <div className="md:w-1/2">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-gray-900">
              How to get started with ONTON
            </h2>
            <p className="mt-4 text-md leading-6 text-gray-600">
              Create your event in under a minute directly in the Telegram Mini App or on the web. Free events are free forever, with immediate publishing, guest list management, and verified check-in.
            </p>
            <p className="mt-4 text-md leading-6 text-gray-600">
              Launch free RSVPs or sell tickets with Telegram Stars and crypto at a flat 3% fee. Attendees receive verifiable credentials upon check-in.
            </p>
            <h3 className="mt-8 text-2xl font-bold text-gray-900">Need help or a custom setup?</h3>
            <p className="mt-4 text-md leading-6 text-gray-600">
              For high-capacity ticketing, custom sponsor integration, or organizer support, reach out to our team via Telegram anytime.
            </p>
          </div>
          {/* <div className="mt-10 md:mt-0 md:w-1/2"> <GetStartedLink /> </div> */}
        </div>
      </div>
    </section>
  );
}
