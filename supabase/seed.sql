-- ============================================================================
-- Development seed — LOCAL ONLY.
--
-- Applied by `supabase db reset`, which never runs against a hosted project.
-- Do not apply this to staging or production.
--
-- Every product row sets `is_mock = true`. That column is not decoration: no
-- surface may present a mock row as live catalogue data, and no price, coupon,
-- availability figure, Deal Score or price chart derived from these rows may be
-- shown to a user (PRD §60, §69). Phase 1's repository layer filters
-- `is_mock = false` unless it is explicitly asked for in development.
--
-- These are invented products at invented prices. They exist so a developer can
-- render a grid before an affiliate feed is approved — nothing more.
-- ============================================================================

insert into public.brands (id, slug, name) values
  ('a0000000-0000-4000-8000-000000000001', 'nike',   'Nike'),
  ('a0000000-0000-4000-8000-000000000002', 'adidas', 'Adidas'),
  ('a0000000-0000-4000-8000-000000000003', 'hm',     'H&M'),
  ('a0000000-0000-4000-8000-000000000004', 'zara',   'Zara')
on conflict (slug) do nothing;

insert into public.categories (id, slug, name, parent_id, position) values
  ('b0000000-0000-4000-8000-000000000001', 'topwear',    'Topwear',    null, 1),
  ('b0000000-0000-4000-8000-000000000002', 'bottomwear', 'Bottomwear', null, 2),
  ('b0000000-0000-4000-8000-000000000003', 'footwear',   'Footwear',   null, 3),
  ('b0000000-0000-4000-8000-000000000011', 'hoodies',    'Hoodies',
     'b0000000-0000-4000-8000-000000000001', 1),
  ('b0000000-0000-4000-8000-000000000012', 'sneakers',   'Sneakers',
     'b0000000-0000-4000-8000-000000000003', 1)
on conflict (slug) do nothing;

insert into public.retailers (id, slug, name, region, website_url) values
  ('c0000000-0000-4000-8000-000000000001', 'myntra',   'Myntra',   'IN', 'https://www.myntra.com'),
  ('c0000000-0000-4000-8000-000000000002', 'amazon-in','Amazon',   'IN', 'https://www.amazon.in'),
  ('c0000000-0000-4000-8000-000000000003', 'ajio',     'AJIO',     'IN', 'https://www.ajio.com'),
  ('c0000000-0000-4000-8000-000000000004', 'flipkart', 'Flipkart', 'IN', 'https://www.flipkart.com')
on conflict (slug) do nothing;

insert into public.products
  (id, slug, title, description, brand_id, category_id, gender, color, material, is_mock)
values
  ('d0000000-0000-4000-8000-000000000001', 'mock-club-oversized-hoodie',
   'Club Oversized Hoodie',
   'A classic oversized hoodie for everyday comfort. Soft fleece, relaxed fit.',
   'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000011',
   'unisex', 'Black', 'Cotton fleece', true),

  ('d0000000-0000-4000-8000-000000000002', 'mock-loose-fit-hoodie',
   'Loose Fit Hoodie',
   'Relaxed hooded sweatshirt in cotton-blend jersey.',
   'a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000011',
   'men', 'Grey', 'Cotton blend', true),

  ('d0000000-0000-4000-8000-000000000003', 'mock-essentials-sneakers',
   'Essentials Low Sneakers',
   'Low-top sneakers with a cushioned midsole.',
   'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000012',
   'unisex', 'White', 'Leather', true)
on conflict (slug) do nothing;

insert into public.product_variants (product_id, size, color, availability) values
  ('d0000000-0000-4000-8000-000000000001', 'S',  'Black', 'in_stock'),
  ('d0000000-0000-4000-8000-000000000001', 'M',  'Black', 'in_stock'),
  ('d0000000-0000-4000-8000-000000000001', 'L',  'Black', 'out_of_stock'),
  ('d0000000-0000-4000-8000-000000000003', '8',  'White', 'in_stock'),
  ('d0000000-0000-4000-8000-000000000003', '9',  'White', 'in_stock')
on conflict do nothing;

-- Invented prices, in integer minor units (paise). The spread across retailers
-- exists so the comparison table has something to compare during development.
insert into public.prices
  (product_id, retailer_id, price_minor, original_minor, currency, availability)
values
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   189900, 299900, 'INR', 'in_stock'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
   194900, 299900, 'INR', 'in_stock'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003',
   179900, 279900, 'INR', 'in_stock'),
  ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   149900, 229900, 'INR', 'in_stock'),
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000004',
   749900, 999900, 'INR', 'in_stock')
on conflict (product_id, variant_id, retailer_id) do nothing;
