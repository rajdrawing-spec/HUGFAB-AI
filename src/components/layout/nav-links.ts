/**
 * Navigation, taken from the guide's header and bottom bar. Defined once so the
 * two can never disagree.
 *
 * `phase` marks a destination that does not exist yet. Those render as disabled
 * hints rather than dead links — an honest empty state beats a 404.
 */
export interface NavLink {
  href: string;
  label: string;
  /** The phase that makes this route real. Undefined means it exists now. */
  phase?: 1 | 2 | 3;
}

/** Desktop header (guide: Women · Men · Kids · Brands · Deals · Community · AI Stylist). */
export const PRIMARY_NAV: readonly NavLink[] = [
  { href: '/women', label: 'Women', phase: 1 },
  { href: '/men', label: 'Men', phase: 1 },
  { href: '/kids', label: 'Kids', phase: 1 },
  { href: '/brands', label: 'Brands', phase: 1 },
  { href: '/deals', label: 'Deals', phase: 2 },
  { href: '/community', label: 'Community', phase: 3 },
  { href: '/stylist', label: 'AI Stylist', phase: 2 },
];

/** Mobile bottom bar (guide: Home · Search · Community · Profile). */
export const MOBILE_NAV: readonly NavLink[] = [
  { href: '/', label: 'Home' },
  { href: '/search', label: 'Search', phase: 1 },
  { href: '/community', label: 'Community', phase: 3 },
  { href: '/settings', label: 'Profile' },
];
