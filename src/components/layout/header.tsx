import Link from 'next/link';
import { PRIMARY_NAV, type NavLink } from './nav-links';
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

        <div className="ml-auto flex items-center gap-2">
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
