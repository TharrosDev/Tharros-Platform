import type { ComponentType } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CalendarRange,
  Clock,
  CreditCard,
  LayoutGrid,
  MessagesSquare,
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
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    label: "Products",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
      { label: "AI Assistant", href: "/assistant", icon: Sparkles },
      { label: "Scheduling", href: "/scheduling", icon: CalendarDays },
      { label: "Lead Capture", href: "/leads", icon: Users },
      { label: "Automations", href: "/automations", icon: Workflow },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Knowledge", href: "/knowledge", icon: BookOpen },
      { label: "Notifications", href: "/notifications", icon: Bell },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Profile", href: "/profile", icon: User },
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "Billing", href: "/billing", icon: CreditCard },
    ],
  },
];

export const schedulingNav: NavItem[] = [
  { label: "Overview", href: "/scheduling", icon: CalendarDays },
  { label: "Schedule", href: "/scheduling/calendar", icon: CalendarRange },
  { label: "Team", href: "/scheduling/employees", icon: Users },
  { label: "Availability", href: "/scheduling/availability", icon: Clock },
  { label: "Conversations", href: "/scheduling/conversations", icon: MessagesSquare },
  { label: "Analytics", href: "/scheduling/analytics", icon: BarChart3 },
  { label: "Activity", href: "/scheduling/activity", icon: Activity },
];

export const allNav: NavItem[] = [
  ...navSections.flatMap((section) => section.items),
  ...schedulingNav.filter((item) => item.href !== "/scheduling"),
];
