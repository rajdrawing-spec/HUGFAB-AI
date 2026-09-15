import { describe, expect, it } from 'vitest';

import {
  feedConfigSchema,
  mapRecordToProduct,
  parseAvailability,
  parseCsvFeed,
  parsePriceToMinor,
  parseXmlFeed,
  type FeedConfig,
} from './feed';

function config(overrides: Partial<FeedConfig> = {}): FeedConfig {
  return feedConfigSchema.parse({
    retailerSlug: 'myntra',
    url: 'https://feeds.example.test/myntra.xml',
    currency: 'INR',
    ...overrides,
  });
}

describe('prices', () => {
  it('converts to integer minor units without going through a float', () => {
    // 18.99 * 100 is 1898.9999999999998 in IEEE-754. A price that renders as
    // ₹18.98 is a bug a shopper can see.
    expect(parsePriceToMinor('18.99', 'INR')).toBe(1899);
    expect(parsePriceToMinor('1899', 'INR')).toBe(189900);
    expect(parsePriceToMinor('1899.00', 'INR')).toBe(189900);
  });

  it('handles the formats feeds actually use', () => {
    expect(parsePriceToMinor('₹1,899.00', 'INR')).toBe(189900);
    expect(parsePriceToMinor('1899.00 INR', 'INR')).toBe(189900);
    expect(parsePriceToMinor(' 1899 ', 'INR')).toBe(189900);
  });

  it('reads the European convention correctly', () => {
    // "1.899,00" is one thousand eight hundred and ninety-nine, not 1.899.
    expect(parsePriceToMinor('1.899,00', 'EUR')).toBe(189900);
    expect(parsePriceToMinor('1,899.00', 'EUR')).toBe(189900);
  });

  it('truncates rather than rounds beyond the currency’s precision', () => {
    expect(parsePriceToMinor('18.999', 'INR')).toBe(1899);
  });

  it('respects a currency with no minor unit', () => {
    expect(parsePriceToMinor('1899', 'JPY')).toBe(1899);
  });

  it('returns null for anything it cannot read', () => {
    expect(parsePriceToMinor(null, 'INR')).toBeNull();
    expect(parsePriceToMinor('', 'INR')).toBeNull();
    expect(parsePriceToMinor('POA', 'INR')).toBeNull();
    expect(parsePriceToMinor('1.2.3', 'INR')).toBeNull();
  });
});

describe('availability', () => {
  it('reads the many ways feeds say the same thing', () => {
    for (const value of ['true', 'yes', '1', 'in stock', 'in_stock', 'available']) {
      expect(parseAvailability(value)).toBe('in_stock');
    }
    for (const value of ['false', 'no', '0', 'out of stock', 'sold out']) {
      expect(parseAvailability(value)).toBe('out_of_stock');
    }
  });

  it('says unknown rather than guessing in stock', () => {
    // Defaulting to in_stock would send shoppers to sold-out pages, and would
    // let an unavailable offer win the best-price slot.
    expect(parseAvailability(null)).toBe('unknown');
    expect(parseAvailability('maybe')).toBe('unknown');
  });
});

describe('XML feeds', () => {
  const yml = `<?xml version="1.0" encoding="UTF-8"?>
    <yml_catalog>
      <shop>
        <offers>
          <offer id="SKU-1" available="true">
            <name>Oversized Hoodie</name>
            <vendor>Nike</vendor>
            <price>1899.00</price>
            <oldprice>2999.00</oldprice>
            <currencyId>INR</currencyId>
            <url>https://www.myntra.com/p/1</url>
            <picture>https://cdn.example.test/1.jpg</picture>
            <picture>https://cdn.example.test/2.jpg</picture>
            <categoryPath>Women &gt; Topwear &gt; Hoodies</categoryPath>
            <barcode>0036000291452</barcode>
          </offer>
          <offer id="SKU-2" available="false">
            <name>Slim Jeans</name>
            <price>2499</price>
            <url>https://www.myntra.com/p/2</url>
          </offer>
        </offers>
      </shop>
    </yml_catalog>`;

  it('finds the product elements without being told which they are', () => {
    const records = parseXmlFeed(yml);
    expect(records).toHaveLength(2);
    expect(records[0]?.['name']).toBe('Oversized Hoodie');
  });

  it('folds attributes in beside elements', () => {
    // YML puts the offer id in an attribute; Google Merchant uses an element.
    const records = parseXmlFeed(yml);
    expect(records[0]?.['id']).toBe('SKU-1');
    expect(records[0]?.['available']).toBe('true');
  });

  it('keeps numbers as strings so SKUs and prices are not corrupted', () => {
    const records = parseXmlFeed(
      '<f><i><sku>007</sku><p>1.10</p></i><i><sku>1</sku></i></f>',
    );
    expect(records[0]?.['sku']).toBe('007');
    expect(records[0]?.['p']).toBe('1.10');
  });

  it('maps a record into a product, offer and identifier', () => {
    const [record] = parseXmlFeed(yml);
    const product = mapRecordToProduct(record!, config());

    expect(product).not.toBeNull();
    expect(product?.title).toBe('Oversized Hoodie');
    expect(product?.brandName).toBe('Nike');
    expect(product?.gender).toBe('women');
    expect(product?.categoryPath).toEqual(['Women', 'Topwear', 'Hoodies']);
    expect(product?.imageUrls).toHaveLength(2);
    expect(product?.identifiers).toEqual([{ type: 'gtin', value: '0036000291452' }]);

    const offer = product?.offers[0];
    expect(offer?.priceMinor).toBe(189900);
    expect(offer?.originalMinor).toBe(299900);
    expect(offer?.availability).toBe('in_stock');
    expect(offer?.retailerSlug).toBe('myntra');
  });

  it('carries an out-of-stock offer through rather than dropping it', () => {
    // An out-of-stock offer is still information: the comparison table sorts
    // it last instead of pretending the retailer does not stock the item.
    const records = parseXmlFeed(yml);
    const product = mapRecordToProduct(records[1]!, config());
    expect(product?.offers[0]?.availability).toBe('out_of_stock');
  });
});

describe('Google Merchant feeds', () => {
  const rss = `<?xml version="1.0"?>
    <rss xmlns:g="http://base.google.com/ns/1.0"><channel>
      <item>
        <g:id>ABC</g:id>
        <g:title>Linen Shirt</g:title>
        <g:brand>Zara</g:brand>
        <g:price>2499.00 INR</g:price>
        <g:link>https://www.ajio.com/p/9</g:link>
        <g:image_link>https://cdn.example.test/9.jpg</g:image_link>
        <g:availability>in stock</g:availability>
        <g:gtin>0036000291452</g:gtin>
        <g:product_type>Men &gt; Shirts</g:product_type>
        <g:gender>male</g:gender>
      </item>
    </channel></rss>`;

  it('reads the g: namespace without extra configuration', () => {
    const [record] = parseXmlFeed(rss, 'item');
    const product = mapRecordToProduct(record!, config({ retailerSlug: 'ajio' }));

    expect(product?.title).toBe('Linen Shirt');
    expect(product?.brandName).toBe('Zara');
    expect(product?.gender).toBe('men');
    expect(product?.offers[0]?.priceMinor).toBe(249900);
    expect(product?.offers[0]?.retailerSlug).toBe('ajio');
  });
});

describe('CSV feeds', () => {
  it('keeps a quoted delimiter inside the field', () => {
    // "Jeans, Slim Fit" is an ordinary product title and the case a naive
    // split(',') gets wrong.
    const rows = parseCsvFeed('id,name,price\n1,"Jeans, Slim Fit",1899\n');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['name']).toBe('Jeans, Slim Fit');
    expect(rows[0]?.['price']).toBe('1899');
  });

  it('unescapes doubled quotes', () => {
    const rows = parseCsvFeed('id,name\n1,"He said ""hi"""\n');
    expect(rows[0]?.['name']).toBe('He said "hi"');
  });

  it('ignores a trailing blank line', () => {
    expect(parseCsvFeed('id,name\n1,A\n\n')).toHaveLength(1);
  });

  it('maps a row into a product', () => {
    const rows = parseCsvFeed(
      'id,name,brand,price,old_price,link,image_link,availability,ean\n' +
        '77,Denim Jacket,Levis,3499.00,4999.00,https://shop.test/77,https://cdn.test/77.jpg,in stock,0036000291452\n',
    );
    const product = mapRecordToProduct(rows[0]!, config({ format: 'csv' }));

    expect(product?.externalId).toBe('77');
    expect(product?.offers[0]?.priceMinor).toBe(349900);
    expect(product?.offers[0]?.originalMinor).toBe(499900);
    expect(product?.identifiers).toEqual([{ type: 'ean', value: '0036000291452' }]);
  });
});

describe('rejecting what cannot be used', () => {
  it('drops a row with no price', () => {
    const rows = parseCsvFeed('id,name,link\n1,Shirt,https://shop.test/1\n');
    expect(mapRecordToProduct(rows[0]!, config({ format: 'csv' }))).toBeNull();
  });

  it('drops a row with no URL to send the buyer to', () => {
    const rows = parseCsvFeed('id,name,price\n1,Shirt,1899\n');
    expect(mapRecordToProduct(rows[0]!, config({ format: 'csv' }))).toBeNull();
  });

  it('drops a row with no identifier of its own', () => {
    const rows = parseCsvFeed('name,price,link\nShirt,1899,https://shop.test/1\n');
    expect(mapRecordToProduct(rows[0]!, config({ format: 'csv' }))).toBeNull();
  });

  it('drops a fabricated discount but keeps the product', () => {
    // An "original" below the current price is bad data, not a bargain. The
    // schema would reject the whole product, so the claim is dropped instead.
    const rows = parseCsvFeed(
      'id,name,price,old_price,link\n1,Shirt,1899,999,https://shop.test/1\n',
    );
    const product = mapRecordToProduct(rows[0]!, config({ format: 'csv' }));

    expect(product).not.toBeNull();
    expect(product?.offers[0]?.originalMinor).toBeNull();
    expect(product?.offers[0]?.priceMinor).toBe(189900);
  });

  it('drops a non-http image rather than failing the product', () => {
    const rows = parseCsvFeed(
      'id,name,price,link,image_link\n1,Shirt,1899,https://shop.test/1,data:image/png;base64\n',
    );
    const product = mapRecordToProduct(rows[0]!, config({ format: 'csv' }));

    expect(product).not.toBeNull();
    expect(product?.imageUrls).toEqual([]);
  });
});

describe('configuration', () => {
  it('overrides a field name without touching code', () => {
    // The point of the field map: an advertiser calling its barcode something
    // unexpected is a config change, not a deployment.
    const rows = parseCsvFeed('sku_code,label,cost,to\n5,Cap,499,https://shop.test/5\n');
    const product = mapRecordToProduct(
      rows[0]!,
      config({
        format: 'csv',
        fieldMap: {
          ...feedConfigSchema.parse({
            retailerSlug: 'x',
            url: 'https://a.test/f.csv',
          }).fieldMap,
          externalId: ['sku_code'],
          title: ['label'],
          price: ['cost'],
          url: ['to'],
        },
      }),
    );

    expect(product?.externalId).toBe('5');
    expect(product?.title).toBe('Cap');
    expect(product?.offers[0]?.priceMinor).toBe(49900);
  });

  it('refuses a retailer slug that is not a slug', () => {
    // Attributing one shop's prices to another makes the comparison worthless,
    // so this is never inferred from the feed.
    expect(() =>
      feedConfigSchema.parse({
        retailerSlug: 'Myntra India',
        url: 'https://a.test/f.xml',
      }),
    ).toThrow();
  });
});

describe('gender', () => {
  it('reads an explicit field', () => {
    const rows = parseCsvFeed(
      'id,name,price,link,gender\n1,Shirt,1899,https://shop.test/1,female\n',
    );
    expect(mapRecordToProduct(rows[0]!, config({ format: 'csv' }))?.gender).toBe('women');
  });

  it('falls back to the category path when the feed has no gender field', () => {
    // Indian fashion feeds routinely carry no gender column and encode it at
    // the top of the taxonomy instead. Without this the gender filter — the
    // first one a shopper reaches for — would return almost nothing.
    const rows = parseCsvFeed(
      'id,name,price,link,category\n1,Hoodie,1899,https://shop.test/1,Women > Topwear\n',
    );
    expect(mapRecordToProduct(rows[0]!, config({ format: 'csv' }))?.gender).toBe('women');
  });

  it('does not read a garment type deeper in the path as a gender', () => {
    // "Boyfriend Shirt" is womenswear.
    const rows = parseCsvFeed(
      'id,name,price,link,category\n1,Shirt,1899,https://shop.test/1,Women > Topwear > Boyfriend Shirt\n',
    );
    expect(mapRecordToProduct(rows[0]!, config({ format: 'csv' }))?.gender).toBe('women');
  });

  it('prefers kids over the gender word beside it', () => {
    const rows = parseCsvFeed(
      'id,name,price,link,gender\n1,Tee,499,https://shop.test/1,Girls\n',
    );
    expect(mapRecordToProduct(rows[0]!, config({ format: 'csv' }))?.gender).toBe('kids');
  });

  it('uses the configured default when nothing says', () => {
    const rows = parseCsvFeed('id,name,price,link\n1,Cap,499,https://shop.test/1\n');
    expect(
      mapRecordToProduct(rows[0]!, config({ format: 'csv', defaultGender: 'unisex' }))
        ?.gender,
    ).toBe('unisex');
  });
});
