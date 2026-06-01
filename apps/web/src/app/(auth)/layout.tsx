import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/auth/current-user";
import { TharrosWordmark } from "@/components/brand/logo";

/**
 * Layout for the unauthenticated auth screens. Centers a single card on the
 * brand background and bounces already-signed-in users back into the app.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (user) redirect("/dashboard");

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <TharrosWordmark markClassName="size-7" />
      {children}
    </div>
  );
}
