import type { ComponentType } from "react";
import {
  BookOpen,
  CreditCard,
  LayoutGrid,
  Settings,
  Sparkles,
  User,
  Users,
  Workflow,
} from "lucide-react";

export type NavIcon = ComponentType<{ className?: string }>;

export type NavItem = {
  label: string;
  href: string;
  icon: NavIcon;
  badge?: string;
};

/** Primary product navigation — the three MVP products plus the dashboard. */
export const primaryNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { label: "AI Assistant", href: "/assistant", icon: Sparkles },
  { label: "Knowledge", href: "/knowledge", icon: BookOpen },
  { label: "Lead Capture", href: "/leads", icon: Users, badge: "3 new" },
  { label: "Automations", href: "/automations", icon: Workflow },
];

/** Account-level navigation, pinned to the bottom of the sidebar. */
export const footerNav: NavItem[] = [
  { label: "Profile", href: "/profile", icon: User },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Billing", href: "/billing", icon: CreditCard },
];

/** Flat list for the command palette. */
export const allNav: NavItem[] = [...primaryNav, ...footerNav];
