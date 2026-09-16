import { SettingsNav } from "@/components/settings/settings-nav";

/**
 * Shared frame for every /settings/* section: a persistent sub-nav rail (left on
 * desktop, a scrollable row on mobile) beside the active section. Each section
 * page renders its own PageHeader as the section title.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-7 lg:grid-cols-[14rem_minmax(0,48rem)] lg:gap-10">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <p className="type-meta text-muted-foreground mb-3 hidden px-1 lg:block">Settings</p>
        <SettingsNav />
      </aside>
      <div className="min-w-0 space-y-7">{children}</div>
    </div>
  );
}
