"use client";
import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export const publicLinks = [
  { href: "/products", label: "Platform" },
  { href: "/solutions", label: "Who it’s for" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "Security" },
  { href: "/contact", label: "Contact" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <div className="public-mobile-nav">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="public-mobile-menu"
        aria-label={open ? "Close navigation" : "Open navigation"}
        onClick={() => setOpen(!open)}
      >
        {open ? <X aria-hidden /> : <Menu aria-hidden />}
      </button>
      {open && (
        <nav
          id="public-mobile-menu"
          aria-label="Mobile navigation"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              event.currentTarget.parentElement?.querySelector("button")?.focus();
            }
          }}
        >
          {publicLinks.map((link) => (
            <Link href={link.href} key={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
          <Link href="/login" onClick={() => setOpen(false)}>
            Sign in
          </Link>
          <Link href="/signup" onClick={() => setOpen(false)}>
            Start free trial
          </Link>
        </nav>
      )}
    </div>
  );
}
