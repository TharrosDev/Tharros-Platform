import type { Metadata } from "next";

import {
  MarketingBackdrop,
  MarketingFooter,
  MarketingHeader,
} from "@/components/marketing/marketing-chrome";
import { Finale } from "@/components/marketing/home/finale";
import { Hero } from "@/components/marketing/home/hero";
import { OperatingModel } from "@/components/marketing/home/operating-model";
import { Principles } from "@/components/marketing/home/principles";
import { ProductStory } from "@/components/marketing/home/product-story";

export const metadata: Metadata = {
  title: { absolute: "Tharros — AI operating workspace for small businesses" },
  description:
    "Business knowledge, workforce scheduling, lead capture and native automation in one operating workspace for small teams.",
};

export default function MarketingHome() {
  return (
    <div className="marketing-light relative flex min-h-screen flex-col overflow-x-clip">
      <MarketingBackdrop />
      <MarketingHeader showPricing />
      <main className="relative">
        <Hero />
        <ProductStory />
        <OperatingModel />
        <Principles />
        <Finale />
      </main>
      <MarketingFooter />
    </div>
  );
}
