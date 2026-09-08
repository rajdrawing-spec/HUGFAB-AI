import Link from 'next/link';
import { PRIMARY_NAV, UTILITY_NAV, type NavLink } from './nav-links';
import { Logo } from './logo';
import { cn } from '@/lib/cn';

export interface HeaderProps {
  /** Null when signed out. Phase 1 swaps the button for an account menu. */
  userEmail?: string | null;
}

export function Header({ userEmail = null }: HeaderProps) {
  return (
    <header className="border-border bg-background/85 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="HugFab home" className="text-text">
          <Logo className="text-h3" />
        </Link>

        <nav aria-label="Primary" className="hidden flex-1 md:block">
          <ul className="flex items-center gap-1">
            {PRIMARY_NAV.map((link) => (
              <li key={link.href}>
                <NavItem {...link} />
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <ul className="hidden items-center gap-1 sm:flex">
            {UTILITY_NAV.map((link) => (
              <li key={link.href}>
                <UtilityItem {...link} />
              </li>
            ))}
          </ul>

          {userEmail ? (
            <Link
              href="/settings"
              className="text-small text-muted hover:bg-surface-2 hover:text-text rounded-md px-3 py-2 transition-colors"
            >
              {userEmail}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-small text-muted hover:bg-surface-2 hover:text-text rounded-md px-3 py-2 transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="text-button bg-primary text-primary-foreground hover:bg-primary-hover rounded-full px-5 py-2.5 font-semibold transition-colors"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * Wishlist and bag. Icon-only, so each carries an `aria-label`; the icon itself
 * is decorative.
 */
function UtilityItem({ href, label, phase }: NavLink) {
  const shared = 'inline-flex rounded-md p-2 transition-colors';
  const icon = label === 'Wishlist' ? <HeartIcon /> : <BagIcon />;

  if (phase) {
    return (
      <span
        aria-disabled="true"
        title={`${label} arrives in Phase ${phase}`}
        className={cn(shared, 'text-muted/50 cursor-not-allowed')}
      >
        {icon}
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(shared, 'text-muted hover:bg-surface-2 hover:text-text')}
    >
      {icon}
    </Link>
  );
}

function HeartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d="M12 20s-7-4.35-7-9a4 4 0 0 1 7-2.65A4 4 0 0 1 19 11c0 4.65-7 9-7 9Z" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d="M5 8h14l-1 12H6L5 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

function NavItem({ href, label, phase }: NavLink) {
  const className = 'text-small rounded-md px-2.5 py-2 font-medium transition-colors';

  if (phase) {
    return (
      <span
        className={cn(className, 'text-muted/60 cursor-not-allowed')}
        title={`Arrives in Phase ${phase}`}
        aria-disabled="true"
      >
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cn(className, 'text-muted hover:bg-surface-2 hover:text-text')}
    >
      {label}
    </Link>
  );
}
