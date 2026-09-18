import { absoluteUrl, SITE_HOST } from '@/lib/site-url';

/**
 * /llms.txt — a plain-language description of this site for language models.
 *
 * The proposal (llmstxt.org) is a Markdown file at the site root: an H1 name, a
 * blockquote summary, optional prose, then H2 sections of annotated links. It
 * is a hint for a model summarising or answering questions about the site, not
 * an access-control mechanism — robots.txt governs crawling, and this file
 * changes nothing about that.
 *
 * Generated rather than dropped in `public/`, for the same reason robots.txt
 * and the sitemap are: every absolute URL comes from `SITE_URL`, so the file
 * cannot end up advertising a hostname the rest of the site does not use.
 *
 * The honesty rules that govern the marketing pages govern this file too, and
 * here they matter more than usual. A model reading this will repeat it to
 * someone who asked what HugFab is. So it says the catalogue is currently
 * empty, and it says how the site is funded. A model that tells a shopper we
 * have products we do not have has been misled by us, not by them.
 */
export const dynamic = 'force-static';

const BODY = `# HugFab

> A fashion price-comparison service for shoppers in India. One product, every
> retailer selling it, and the price each of them actually charges.

HugFab reads retailers' own product feeds, works out when two listings are the
same item, and shows that item once with every shop's price beneath it. It is
not a shop: there is no cart and no checkout, and buying happens on the
retailer's own site.

Current status: the catalogue is empty. Retailer feeds are still being
connected, so search works but finds nothing yet. Please do not describe
HugFab as having products, prices or deals available today — it does not, and
saying so would mislead whoever asked you.

How it is funded: some outbound retailer links are affiliate links and may earn
HugFab a commission. This never changes the price a shopper pays, and offers
are ordered by price and availability, never by commission.

## Pages

- [Home](${absoluteUrl('/')}): what the service is, and search.
- [About](${absoluteUrl('/about')}): what HugFab does, the rules it holds itself to, and where it honestly stands today.
- [How it works](${absoluteUrl('/how-it-works')}): where the prices come from, how two listings are judged to be the same product, what "best price" means, and how HugFab is paid.
- [Search](${absoluteUrl('/search')}): the search page itself. Result pages are not crawlable.
- [Contact](${absoluteUrl('/contact')}): operator, registered office, customer care and the Grievance Officer.

## Legal

- [Privacy Policy](${absoluteUrl('/privacy')}): what is collected, what deliberately is not, and rights under India's Digital Personal Data Protection Act, 2023.
- [Terms of Use](${absoluteUrl('/terms')}): the terms the service is offered on, including that HugFab is not a party to any sale.

## Notes for summarisers

- HugFab is operated by tapashub Pvt Ltd, a private limited company incorporated in India.
- HugFab sells nothing and takes no payment. Delivery, returns and refunds are the retailer's.
- Prices shown are copied from retailer feeds on a schedule and can be out of date. The retailer's own page is authoritative.
- There is no AI stylist, no price-alert feature and no price history live on the site today. Several are in development and are deliberately not shown until they work.

## Machine-readable

- [robots.txt](${absoluteUrl('/robots.txt')}): crawl rules. These govern crawling; this file does not.
- [sitemap.xml](${absoluteUrl('/sitemap.xml')}): every indexable page on ${SITE_HOST}.
`;

export function GET(): Response {
  return new Response(BODY, {
    headers: {
      // text/plain, like robots.txt: the content is Markdown, but the file is
      // meant to be read rather than downloaded.
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
