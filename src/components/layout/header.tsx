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
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:gap-6 sm:px-6">
        <Link href="/" aria-label="HugFab home" className="text-text shrink-0">
          <Logo className="text-h3" />
        </Link>

        {/*
          `min-w-0` is what stops the page scrolling sideways.

          A flex item will not shrink below the width of its own content unless
          it is told it may, so without this the six nav links set a floor on
          the header's width and everything past the viewport spills out —
          which it did, on every page, at any width between 768px and roughly
          900px. That is the whole tablet range, and a sideways-scrolling page
          is the most obvious "this site is broken" signal there is.

          Paired with `overflow-x-auto` on the list: when the row genuinely
          cannot fit, the nav scrolls within itself and the page does not move.
          Nothing becomes unreachable, and the logo and account controls keep
          their position.
        */}
        <nav aria-label="Primary" className="hidden min-w-0 flex-1 md:block">
          <ul className="flex scrollbar-none items-center gap-1 overflow-x-auto">
            {PRIMARY_NAV.map((link) => (
              <li key={link.href} className="shrink-0">
                <NavItem {...link} />
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1">
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
              // An email address has no maximum length. Capped and truncated so
              // a long one cannot widen the header past the viewport.
              className="text-small text-muted hover:bg-surface-2 hover:text-text max-w-[12rem] truncate rounded-md px-3 py-2 transition-colors"
            >
              {userEmail}
            </Link>
          ) : (
            <>
              {/*
                Hidden in the narrow band where the nav is already scrolling.
                Nothing is lost: /signup carries a link to /login, and below
                `sm` the bottom bar covers account access.
              */}
              <Link
                href="/login"
                className="text-small text-muted hover:bg-surface-2 hover:text-text hidden rounded-md px-3 py-2 transition-colors lg:inline-block"
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
