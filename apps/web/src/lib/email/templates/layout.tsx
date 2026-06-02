import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

import { font, palette } from "./theme";

/**
 * Shared shell for every Tharros email. Maple Pure-styled, light-mode only,
 * inline styles (email clients ignore external/embedded CSS). Renders both as a
 * React element (app-sent mail via lib/email/send) and to a static HTML string
 * for Supabase Auth templates (via @react-email/render).
 *
 * The footer carries sender identity; a full CASL physical-address + unsubscribe
 * block lands on Day 58 (compliance) when outbound lead mail ships.
 */
export type EmailLayoutProps = {
  /** Inbox preview snippet (hidden in body). */
  preview: string;
  children: ReactNode;
};

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={brandRow}>
            <Heading style={wordmark}>Tharros</Heading>
          </Section>
          <Section style={card}>{children}</Section>
          <Section style={footer}>
            <Text style={footerText}>
              Tharros, the AI operating layer for small businesses.
            </Text>
            <Text style={footerMuted}>
              You received this email because an account action was requested at{" "}
              <Link href="https://tharros.ca" style={footerLink}>
                tharros.ca
              </Link>
              . If this wasn&apos;t you, you can safely ignore it.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** Shared content primitives so each template stays consistent. */
export function EmailHeading({ children }: { children: ReactNode }) {
  return <Heading style={heading}>{children}</Heading>;
}

export function EmailText({ children }: { children: ReactNode }) {
  return <Text style={paragraph}>{children}</Text>;
}

export function EmailButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  // Hand-rolled anchor button (not <Button>) so the literal Go-template href
  // used by Supabase ({{ .SiteURL }}/...) passes through render untouched.
  return (
    <Section style={{ textAlign: "center", margin: "32px 0" }}>
      <Link href={href} style={button}>
        {children}
      </Link>
    </Section>
  );
}

export function EmailFallbackLink({ href }: { href: string }) {
  return (
    <>
      <EmailText>
        Or copy and paste this link into your browser:
      </EmailText>
      <Text style={fallback}>
        <Link href={href} style={fallbackLink}>
          {href}
        </Link>
      </Text>
    </>
  );
}

export function EmailDivider() {
  return <Hr style={divider} />;
}

const body = {
  backgroundColor: palette.canvas,
  fontFamily: font,
  margin: 0,
  padding: "32px 0",
};

const container = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "0 16px",
};

const brandRow = {
  padding: "4px 0 20px",
};

const wordmark = {
  color: palette.maple,
  fontSize: "22px",
  fontWeight: 700,
  letterSpacing: "-0.01em",
  margin: 0,
};

const card = {
  backgroundColor: palette.card,
  border: `1px solid ${palette.border}`,
  borderRadius: "8px",
  padding: "32px",
};

const heading = {
  color: palette.ink,
  fontSize: "22px",
  fontWeight: 700,
  lineHeight: "1.25",
  margin: "0 0 16px",
};

const paragraph = {
  color: palette.ink,
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0 0 16px",
};

const button = {
  backgroundColor: palette.maple,
  borderRadius: "8px",
  color: palette.mapleText,
  display: "inline-block",
  fontSize: "16px",
  fontWeight: 600,
  padding: "12px 28px",
  textDecoration: "none",
};

const fallback = {
  margin: "0 0 8px",
  wordBreak: "break-all" as const,
};

const fallbackLink = {
  color: palette.maple,
  fontSize: "13px",
};

const divider = {
  borderColor: palette.border,
  margin: "24px 0",
};

const footer = {
  padding: "20px 8px 0",
};

const footerText = {
  color: palette.mutedInk,
  fontSize: "13px",
  fontWeight: 600,
  margin: "0 0 6px",
};

const footerMuted = {
  color: palette.mutedInk,
  fontSize: "12px",
  lineHeight: "1.5",
  margin: 0,
};

const footerLink = {
  color: palette.maple,
};
