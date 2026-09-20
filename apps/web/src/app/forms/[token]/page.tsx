import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPublicCaptureForm } from "@/lib/leads/capture";
import { submitPublicLead } from "@/lib/leads/public-actions";
import { TharrosWordmark } from "@/components/brand/logo";
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
    <main className="bg-background text-foreground relative flex min-h-dvh flex-col overflow-x-clip">
      {/* Quiet chrome: a stranger filling in a contact form is not shown an app
          nav with "Sign in" and "Get started". */}
      <div className="border-border flex items-center border-b px-5 py-4">
        <TharrosWordmark markClassName="size-6" />
      </div>
      <section className="relative mx-auto flex w-full max-w-xl flex-1 items-center px-5 py-14">
        <Card className="w-full">
          <CardHeader className="px-6 pt-7 sm:px-8">
            <CardTitle className="type-h1">{form.headline}</CardTitle>
            <CardDescription>{form.name}</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-7 sm:px-8">
            {query.submitted ? (
              <div
                role="status"
                className="bg-stock-cleared border-success text-foreground border p-5"
              >
                <p className="type-h2">Message received</p>
                <p className="type-body text-muted-foreground mt-1">{form.successMessage}</p>
              </div>
            ) : (
              <form action={action} className="space-y-4">
                {query.error ? (
                  <div
                    role="alert"
                    className="border-destructive bg-stock-signal text-foreground type-body border px-4 py-3"
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
    </main>
  );
}
