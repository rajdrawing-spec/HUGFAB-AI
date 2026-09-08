'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MOBILE_ACTION, MOBILE_NAV, type NavLink } from './nav-links';
import { cn } from '@/lib/cn';

/**
 * Mobile primary navigation: four destinations either side of a raised action
 * button, as in the concept. Hidden from md upwards, where the header nav takes
 * over. Sits above the iOS home indicator via `env(safe-area-inset-bottom)`.
 */
export function BottomNavigation() {
  const pathname = usePathname();
  const [first, second, third, fourth] = MOBILE_NAV;

  return (
    <nav
      aria-label="Primary"
      className="border-border bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-md md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md items-stretch">
        {[first, second].map(
          (link) =>
            link && (
              <li key={link.href} className="flex-1">
                <BottomNavItem link={link} active={pathname === link.href} />
              </li>
            ),
        )}

        <li className="flex flex-1 items-center justify-center">
          <ActionButton />
        </li>

        {[third, fourth].map(
          (link) =>
            link && (
              <li key={link.href} className="flex-1">
                <BottomNavItem link={link} active={pathname === link.href} />
              </li>
            ),
        )}
      </ul>
    </nav>
  );
}

/**
 * The raised centre button. Not a destination — it opens visual search now and
 * post composition once the community exists — so it is deliberately outside
 * the list of nav items above.
 */
function ActionButton() {
  const shared =
    'flex size-12 -translate-y-3 items-center justify-center rounded-full shadow-md transition-colors';

  if (MOBILE_ACTION.phase) {
    return (
      <span
        aria-disabled="true"
        title={`Arrives in Phase ${MOBILE_ACTION.phase}`}
        className={cn(shared, 'bg-primary/50 text-primary-foreground cursor-not-allowed')}
      >
        <PlusIcon />
        <span className="sr-only">{MOBILE_ACTION.label}</span>
      </span>
    );
  }

  return (
    <Link
      href={MOBILE_ACTION.href}
      aria-label={MOBILE_ACTION.label}
      className={cn(shared, 'bg-primary text-primary-foreground hover:bg-primary-hover')}
    >
      <PlusIcon />
    </Link>
  );
}

function BottomNavItem({ link, active }: { link: NavLink; active: boolean }) {
  const shared =
    'text-caption flex h-14 flex-col items-center justify-center gap-1 transition-colors';

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

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}
