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
    <main className="bg-background text-foreground relative flex min-h-screen flex-col overflow-x-clip">
      <MarketingBackdrop />
      <MarketingHeader />

      <section className="relative mx-auto flex w-full max-w-xl flex-1 items-center px-5 py-14">
        <Card className="shadow-raised w-full rounded-2xl">
          <CardHeader className="px-6 pt-7 sm:px-8">
            <CardTitle className="text-[1.75rem] font-semibold tracking-[-0.03em]">
              {form.headline}
            </CardTitle>
            <CardDescription>{form.name}</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-7 sm:px-8">
            {query.submitted ? (
              <div
                role="status"
                className="bg-success/[0.07] text-success rounded-lg border border-success/25 p-5"
              >
                <p className="font-semibold">Message received</p>
                <p className="mt-1 text-sm">{form.successMessage}</p>
              </div>
            ) : (
              <form action={action} className="space-y-4">
                {query.error ? (
                  <div
                    role="alert"
                    className="border-destructive/25 bg-destructive/[0.06] text-destructive rounded-lg border px-4 py-3 text-sm"
                  >
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
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      maxLength={320}
                    />
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
                  Powered by Tharros. Submission details are sent to the business that shared this
                  form.
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
