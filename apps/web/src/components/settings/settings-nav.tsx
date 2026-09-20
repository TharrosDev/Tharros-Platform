"use client";

import { Bell, Building2, Gauge, TriangleAlert, Users } from "lucide-react";

import { SectionNav, type SectionNavItem } from "@/components/shell/section-nav";

const SECTIONS: SectionNavItem[] = [
  { href: "/settings/organization", label: "Business profile", icon: Building2 },
  { href: "/settings/team", label: "Members", icon: Users },
  { href: "/settings/usage", label: "Usage", icon: Gauge },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/danger", label: "Danger zone", icon: TriangleAlert, danger: true },
];

/**
 * Persistent settings sub-nav over the shared SectionNav rail: vertical on
 * desktop, a horizontal scrollable row on mobile, sliding seated strip.
 */
export function SettingsNav() {
  return (
    <SectionNav
      items={SECTIONS}
      ariaLabel="Settings sections"
      ns="settings"
      orientation="responsive"
    />
  );
}
