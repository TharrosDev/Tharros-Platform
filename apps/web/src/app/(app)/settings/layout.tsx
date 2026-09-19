import { SettingsNav } from "@/components/settings/settings-nav";

/**
 * Shared frame for every /settings/* section: a persistent sub-nav rail (left on
 * desktop, a scrollable row on mobile) beside the active section. Each section
 * page renders its own PageHeader as the section title.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[13rem_minmax(0,44rem)] lg:gap-10">
      <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
        <p className="text-muted-foreground mb-2 hidden px-2.5 text-sm font-medium lg:block">Settings</p>
        <SettingsNav />
      </aside>
      <div className="min-w-0 space-y-8">{children}</div>
    </div>
  );
}
