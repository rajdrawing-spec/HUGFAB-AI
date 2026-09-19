/**
 * The stand-in shown when a product has no photograph.
 *
 * There are no product images in the catalogue yet and there is no honest way
 * to invent one: a photograph is a claim about what the item looks like, and a
 * borrowed or generated picture attached to a demo product would be the one
 * kind of fake this site has been careful to avoid everywhere else.
 *
 * So rather than a grey box with a broken-image glyph repeated down the grid —
 * which reads as a site that failed to load — each product gets a calm,
 * deterministic colourway derived from its own slug, with its initials over
 * it. It claims nothing, it is stable across renders and deploys, and a grid
 * of them looks composed rather than empty.
 *
 * When real imagery arrives with a feed, `imageUrls[0]` wins and this is never
 * rendered. Nothing here needs removing first.
 */

import { hueFromSlug, initialsFor } from './placeholder-art';

export function ProductImagePlaceholder({
  slug,
  title,
  size = 'md',
}: {
  slug: string;
  title: string;
  /** `lg` is the product page's hero; `md` is a grid card. */
  size?: 'md' | 'lg';
}) {
  const hue = hueFromSlug(slug);

  return (
    <div
      aria-hidden="true"
      className="flex h-full w-full items-center justify-center"
      style={{
        // Two stops from the same hue keeps every tile in the grid related
        // without any of them fighting the product card's own colours.
        backgroundImage:
          `linear-gradient(145deg, ` +
          `oklch(0.93 0.045 ${hue}) 0%, ` +
          `oklch(0.87 0.065 ${(hue + 28) % 360}) 100%)`,
      }}
    >
      <span
        className={
          size === 'lg'
            ? 'text-5xl font-semibold tracking-tight'
            : 'text-2xl font-semibold tracking-tight'
        }
        style={{ color: `oklch(0.42 0.06 ${hue})` }}
      >
        {initialsFor(title)}
      </span>
    </div>
  );
}
