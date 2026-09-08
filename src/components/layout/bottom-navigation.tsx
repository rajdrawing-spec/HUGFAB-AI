'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MOBILE_NAV, type NavLink } from './nav-links';
import { cn } from '@/lib/cn';

/**
 * Mobile primary navigation. Hidden from md upwards, where the header nav takes
 * over. Sits above the iOS home indicator via `env(safe-area-inset-bottom)`.
 */
export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="border-border bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-md md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md items-stretch">
        {MOBILE_NAV.map((link) => (
          <li key={link.href} className="flex-1">
            <BottomNavItem link={link} active={pathname === link.href} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function BottomNavItem({ link, active }: { link: NavLink; active: boolean }) {
  const shared =
    'flex h-14 flex-col items-center justify-center gap-1 text-caption transition-colors';

  if (link.phase) {
    return (
      <span
        className={cn(shared, 'text-muted/50 cursor-not-allowed')}
        title={`Arrives in Phase ${link.phase}`}
        aria-disabled="true"
      >
        <NavDot />
        {link.label}
      </span>
    );
  }

  return (
    <Link
      href={link.href}
      aria-current={active ? 'page' : undefined}
      className={cn(shared, active ? 'text-primary' : 'text-muted hover:text-text')}
    >
      <NavDot />
      {link.label}
    </Link>
  );
}

function NavDot() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="currentColor" aria-hidden="true">
      <circle cx="10" cy="10" r="4" />
    </svg>
  );
}
