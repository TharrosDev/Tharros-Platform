import * as React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
    <div className="w-full max-w-sm space-y-4">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="type-h2">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      {footer ? (
        <p className="text-muted-foreground text-center text-sm">{footer}</p>
      ) : null}
    </div>
  );
}

/** Inline field-level validation message. */
export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-destructive text-sm">
      {message}
    </p>
  );
}

/** Form-level error / status banner. */
export function FormMessage({
  tone = "error",
  children,
}: {
  tone?: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm"
          : "bg-success/10 text-success rounded-lg px-3 py-2 text-sm"
      }
    >
      {children}
    </div>
  );
}
