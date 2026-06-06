import { ToastProvider, Toaster } from "@/components/ui/toast";

/**
 * Day 45 — portal route layout. The employee portal is a top-level route group
 * (outside `(app)`), so it does NOT inherit the app shell's providers. Day-45
 * availability collection raises toasts (`useToast`), and Base UI's
 * `useToastManager` throws if it can't find a `<Toast.Provider>` ancestor — so the
 * portal needs its own. Kept minimal: no sidebar/topbar (the portal pages render
 * their own mobile shell), just the toast context + viewport.
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <Toaster />
    </ToastProvider>
  );
}
