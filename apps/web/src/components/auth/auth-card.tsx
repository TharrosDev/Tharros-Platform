import * as React from "react";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { FadeIn } from "@/components/motion";

/**
 * Shared shell for the auth screens: a titled card with an optional footer link
 * row beneath it. Keeps the four forms visually consistent and small.
 */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-md space-y-5">
      <Card className="visual-panel-strong overflow-hidden rounded-3xl shadow-raised">
        <CardHeader className="px-6 pb-2 pt-8 text-center sm:px-8">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gradient-to-r from-primary to-info" aria-hidden />
          <h1 data-slot="card-title" className="text-2xl font-bold tracking-[-0.035em]">
            {title}
          </h1>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent className="px-6 pb-8 sm:px-8">{children}</CardContent>
      </Card>
      {footer ? <p className="text-muted-foreground text-center text-sm">{footer}</p> : null}
    </div>
  );
}

/** Inline field-level validation message. */
export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-destructive mt-1 text-sm leading-relaxed">
      {message}
    </p>
  );
}

/** Form-level error / status banner. Eases in so a new message reads as an event. */
export function FormMessage({
  tone = "error",
  children,
}: {
  tone?: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <FadeIn rise={4}>
      <div
        role={tone === "error" ? "alert" : "status"}
        className={
          tone === "error"
            ? "border-destructive/20 bg-destructive/10 text-destructive rounded-lg border px-3.5 py-3 text-sm leading-relaxed"
            : "border-success/20 bg-success/10 text-success rounded-lg border px-3.5 py-3 text-sm leading-relaxed"
        }
      >
        {children}
      </div>
    </FadeIn>
  );
}
