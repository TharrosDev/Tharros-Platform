import type { Metadata } from "next";

import { Finale } from "@/components/marketing/home/finale";
import { Hero } from "@/components/marketing/home/hero";
import { OperatingModel } from "@/components/marketing/home/operating-model";
import { Principles } from "@/components/marketing/home/principles";
import { ProductStory } from "@/components/marketing/home/product-story";

export const metadata: Metadata = {
  title: { absolute: "Tharros \u2014 AI operating workspace for small businesses" },
  description:
    "Business knowledge, workforce scheduling, lead capture and native automation in one operating workspace for small teams.",
};

export default function MarketingHome() {
  return (
    <>
      <Hero />
      <ProductStory />
      <OperatingModel />
      <Principles />
      <Finale />
    </>
  );
}
