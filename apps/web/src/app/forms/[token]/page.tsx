import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPublicCaptureForm } from "@/lib/leads/capture";
import { submitPublicLead } from "@/lib/leads/public-actions";
import {
  MarketingBackdrop,
  MarketingFooter,
  MarketingHeader,
} from "@/components/marketing/marketing-chrome";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const metadata: Metadata = {
  title: "Contact form",
  robots: { index: false, follow: false },
};

export default async function PublicLeadFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const form = await getPublicCaptureForm(token);
  if (!form) notFound();

  const action = submitPublicLead.bind(null, token);

  return (
    <main className="bg-sidebar text-sidebar-foreground relative flex min-h-screen flex-col overflow-hidden">
      <MarketingBackdrop />
      <MarketingHeader />

      <section className="relative mx-auto flex w-full max-w-xl flex-1 items-center px-5 py-14">
        <Card className="w-full overflow-hidden rounded-3xl border-primary/15 bg-card text-card-foreground shadow-modal">
          <CardHeader>
            <div className="mb-2 h-1 w-10 rounded-full bg-gradient-to-r from-primary to-info" aria-hidden />
            <CardTitle className="text-3xl font-bold tracking-[-0.04em]">{form.headline}</CardTitle>
            <CardDescription>{form.name}</CardDescription>
          </CardHeader>
          <CardContent>
            {query.submitted ? (
              <div className="bg-success/10 text-success rounded-xl border border-success/20 p-5 shadow-inner">
                <p className="font-medium">Message received</p>
                <p className="mt-1 text-sm">{form.successMessage}</p>
              </div>
            ) : (
              <form action={action} className="space-y-4">
                {query.error ? (
                  <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm">
                    We could not submit that message. Check the fields and try again.
                  </div>
                ) : null}

                <div className="absolute -left-[10000px]" aria-hidden>
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" name="website" tabIndex={-1} autoComplete="off" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" autoComplete="name" required maxLength={160} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" autoComplete="email" maxLength={320} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={80} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company">Company</Label>
                  <Input id="company" name="company" autoComplete="organization" maxLength={160} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="message">How can we help?</Label>
                  <Textarea id="message" name="message" maxLength={4000} />
                </div>
                <Button type="submit" className="w-full">
                  Send message
                </Button>
                <p className="text-muted-foreground text-center text-xs">
                  Powered by Tharros. Submission details are sent to the business that shared this form.
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </section>

      <MarketingFooter />
    </main>
  );
}
