/**
 * Navigation, taken from the UI/UX concept (docs/ui-ux-guide.md §Screens).
 * Defined once so the desktop header and the mobile bar cannot drift apart.
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

/** Desktop header: Home · Discover · Deals · Community · Brands · AI Stylist. */
export const PRIMARY_NAV: readonly NavLink[] = [
  { href: '/', label: 'Home' },
  { href: '/discover', label: 'Discover', phase: 1 },
  { href: '/deals', label: 'Deals', phase: 2 },
  { href: '/community', label: 'Community', phase: 3 },
  { href: '/brands', label: 'Brands', phase: 1 },
  { href: '/stylist', label: 'AI Stylist', phase: 2 },
];

/** Header utility icons, to the right of the primary nav. */
export const UTILITY_NAV: readonly NavLink[] = [
  { href: '/wishlist', label: 'Wishlist', phase: 1 },
  { href: '/bag', label: 'Bag', phase: 1 },
];

/**
 * Mobile bar. The concept puts a raised pink action button in the middle —
 * create a post in Phase 3, and the visual-search entry point before that. It
 * is a peer of the four destinations, not one of them, so it is modelled
 * separately rather than as a fifth nav link with a fake href.
 */
export const MOBILE_NAV: readonly NavLink[] = [
  { href: '/', label: 'Home' },
  { href: '/search', label: 'Search', phase: 1 },
  { href: '/community', label: 'Community', phase: 3 },
  { href: '/settings', label: 'Profile' },
];

export const MOBILE_ACTION: NavLink = {
  href: '/search/visual',
  label: 'Search by photo',
  phase: 2,
};
