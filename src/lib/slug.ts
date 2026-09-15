/**
 * URL slugs, matching the `^[a-z0-9]+(-[a-z0-9]+)*$` check constraint every
 * slug column in the schema carries.
 *
 * Feed titles are not written with URLs in mind. They arrive with accents,
 * ampersands, quotation marks, trademark symbols, Devanagari, and the
 * occasional emoji, and any of those would fail the constraint on insert — an
 * error that surfaces as a rejected product rather than as the formatting
 * problem it is.
 */

/**
 * Decomposes accents so "Zarå" becomes "zara" rather than "zar". Characters
 * with no Latin form at all (Devanagari, CJK) leave nothing behind, which is
 * why `slugify` can legitimately return an empty string.
 */
function stripDiacritics(input: string): string {
  return input.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

export function slugify(input: string): string {
  return stripDiacritics(input)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/**
 * A slug guaranteed to satisfy the constraint, even when the title has no
 * Latin characters to work with.
 *
 * `discriminator` is mixed in so two products called "Oversized Hoodie" do not
 * collide. It is the caller's stable value — an identifier or the provider's
 * external id — rather than a random one, so re-ingesting the same item
 * produces the same slug and the URL a user bookmarked keeps working.
 */
export function productSlug(title: string, discriminator: string): string {
  const base = slugify(title);
  const suffix = slugify(discriminator).slice(0, 24) || 'item';
  return base === '' ? `product-${suffix}` : `${base}-${suffix}`;
}
