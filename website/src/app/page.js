"use client";

import CTASection from "@/components/sections/CTASection";
import StatisticsSection from "@/components/sections/StatisticSection";
import FeaturedEventsSection from "@/components/sections/FeaturedEventsSection";
import FeaturesSection from "@/components/sections/FeaturesSection";
import CaseStudySection from "@/components/sections/CaseStudySection";
import LeaderboardSection from "@/components/sections/LeaderboardSection";
import HowItWorksSection from "@/components/sections/HowWorksSection";
import NewsletterSection from "@/components/sections/NewsletterSection";
import ONIONSection from "@/components/sections/ONIONSection";

export default function Home() {
  return (
    <>
      <CTASection />
      <StatisticsSection />
      <FeaturedEventsSection />
      <FeaturesSection />
      <CaseStudySection />
      <LeaderboardSection />
      <HowItWorksSection />
      <NewsletterSection />
      <ONIONSection />
    </>
  );
}
