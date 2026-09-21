import Link from "next/link";
import { TharrosWordmark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { HeaderShell } from "./header-shell";
import { MobileNav } from "./mobile-nav";
import { productDetails } from "./content";
const marketingContainer = "mx-auto w-full max-w-board px-5 sm:px-10";
const links = [
  { href: "/products", label: "Platform" },
  { href: "/solutions", label: "Who it’s for" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "Security" },
];
function MarketingHeader() {
  return (
    <HeaderShell>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:bg-card focus:p-3"
      >
        Skip to content
      </a>
      <div className="marketing-wrap public-header-row">
        <Link href="/" aria-label="Tharros home">
          <TharrosWordmark markClassName="size-8" />
        </Link>
        <nav className="public-desktop-nav" aria-label="Main navigation">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="public-nav-link">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="public-account">
          <Link href="/login" className="public-nav-link">
            Sign in
          </Link>
          <Link href="/signup" className={buttonVariants({ size: "sm" })}>
            Start free trial
          </Link>
          <MobileNav />
        </div>
      </div>
    </HeaderShell>
  );
}
function MarketingFooter() {
  return (
    <footer className="public-footer">
      <div className="marketing-wrap">
        <div className="public-footer-grid">
          <div>
            <Link href="/" aria-label="Tharros home">
              <TharrosWordmark markClassName="size-8" />
            </Link>
            <p>
              A clearer workday for Canadian businesses and organizations. Large, small and growing.
            </p>
          </div>
          <nav aria-label="Explore products">
            <strong>One workspace</strong>
            {productDetails.map((product) => (
              <Link key={product.slug} href={`/products/${product.slug}`}>
                {product.name}
              </Link>
            ))}
          </nav>
          <nav aria-label="Explore Tharros">
            <strong>Explore Tharros</strong>
            <Link href="/solutions">Who it’s for</Link>
            <Link href="/how-it-works">How it works</Link>
            <Link href="/pricing">Plans & pricing</Link>
            <Link href="/contact">Contact</Link>
          </nav>
          <nav aria-label="Trust and support">
            <strong>Here to help</strong>
            <Link href="/security">Security & controls</Link>
            <Link href="/privacy">Privacy policy</Link>
            <Link href="/terms">Terms of service</Link>
            <Link href="/portal">Employee portal</Link>
            <Link href="/login">Sign in</Link>
          </nav>
        </div>
        <div className="public-footer-bottom">
          <span>© {new Date().getFullYear()} Tharros. All rights reserved.</span>
          <span>Built for Canadian workdays. Prices in CAD.</span>
        </div>
      </div>
    </footer>
  );
}
export { MarketingFooter, MarketingHeader, marketingContainer };
