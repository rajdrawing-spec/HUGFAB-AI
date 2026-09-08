import Link from 'next/link';
import { Logo } from './logo';

const YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="border-border bg-surface mt-auto border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Logo className="text-h3" />
          <p className="text-small text-text mt-1 font-medium">
            See it. Style it. Shop it.
          </p>
          <p className="text-small text-muted mt-3">
            AI-powered fashion discovery. Your style, every store, one place.
          </p>
        </div>

        <nav aria-label="Footer" className="flex gap-12">
          <ul className="text-small flex flex-col gap-2">
            <li className="text-caption text-muted font-medium tracking-wide uppercase">
              Company
            </li>
            <li>
              <FooterLink href="/about">About</FooterLink>
            </li>
            <li>
              <FooterLink href="/contact">Contact</FooterLink>
            </li>
          </ul>
          <ul className="text-small flex flex-col gap-2">
            <li className="text-caption text-muted font-medium tracking-wide uppercase">
              Legal
            </li>
            <li>
              <FooterLink href="/privacy">Privacy</FooterLink>
            </li>
            <li>
              <FooterLink href="/terms">Terms</FooterLink>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-border border-t">
        <div className="text-caption text-muted mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {YEAR} HugFab · Building a more stylish, connected and smarter shopping
            future
          </p>
          {/* Required disclosure wherever affiliate links appear (PRD §74). */}
          <p>HugFab earns a commission on some purchases made through our links.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="text-muted hover:text-text transition-colors">
      {children}
    </Link>
  );
}
