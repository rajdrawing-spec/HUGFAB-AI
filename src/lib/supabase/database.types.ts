/**
 * Database types for the schema created by `supabase/migrations/0001_core.sql`.
 *
 * Hand-written to match that migration, because generating them needs a running
 * project. Once one exists, replace this file wholesale:
 *
 *   supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
 *
 * Until then, `scripts/verify-migration.sh` is what keeps the schema honest;
 * these types are checked against it by review, not by a compiler.
 */

export type UserRole = 'user' | 'admin';
export type Gender = 'women' | 'men' | 'unisex' | 'kids';
export type Availability =
  'in_stock' | 'out_of_stock' | 'preorder' | 'discontinued' | 'unknown';

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

interface Timestamps {
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Timestamps & {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          role: UserRole;
          locale: string;
          currency: string;
        };
        Insert: Partial<Timestamps> & {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          locale?: string;
          currency?: string;
        };
        // `role` is absent on purpose: the escalation trigger rejects a change
        // to it from anon/authenticated, so offering it here would be a lie.
        Update: {
          display_name?: string | null;
          avatar_url?: string | null;
          locale?: string;
          currency?: string;
        };
        Relationships: [];
      };

      brands: {
        Row: Timestamps & {
          id: string;
          slug: string;
          name: string;
          logo_url: string | null;
          description: string | null;
        };
        Insert: Partial<Timestamps> & {
          id?: string;
          slug: string;
          name: string;
          logo_url?: string | null;
          description?: string | null;
        };
        Update: Partial<Database['public']['Tables']['brands']['Insert']>;
        Relationships: [];
      };

      categories: {
        Row: Timestamps & {
          id: string;
          slug: string;
          name: string;
          parent_id: string | null;
          position: number;
        };
        Insert: Partial<Timestamps> & {
          id?: string;
          slug: string;
          name: string;
          parent_id?: string | null;
          position?: number;
        };
        Update: Partial<Database['public']['Tables']['categories']['Insert']>;
        Relationships: [];
      };

      retailers: {
        Row: Timestamps & {
          id: string;
          slug: string;
          name: string;
          logo_url: string | null;
          website_url: string | null;
          region: string;
          is_active: boolean;
        };
        Insert: Partial<Timestamps> & {
          id?: string;
          slug: string;
          name: string;
          logo_url?: string | null;
          website_url?: string | null;
          region?: string;
          is_active?: boolean;
        };
        Update: Partial<Database['public']['Tables']['retailers']['Insert']>;
        Relationships: [];
      };

      /** Service-role only: RLS is on and no policy grants anon/authenticated access. */
      affiliate_providers: {
        Row: Timestamps & {
          id: string;
          slug: string;
          name: string;
          is_active: boolean;
          config: Json;
          last_synced_at: string | null;
        };
        Insert: Partial<Timestamps> & {
          id?: string;
          slug: string;
          name: string;
          is_active?: boolean;
          config?: Json;
          last_synced_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['affiliate_providers']['Insert']>;
        Relationships: [];
      };

      products: {
        Row: Timestamps & {
          id: string;
          slug: string;
          title: string;
          description: string | null;
          brand_id: string | null;
          category_id: string | null;
          gender: Gender;
          color: string | null;
          material: string | null;
          image_urls: string[];
          source_provider_id: string | null;
          external_id: string | null;
          is_mock: boolean;
          is_active: boolean;
          /** Generated column — never written by the application. */
          search_vector: unknown;
        };
        Insert: Partial<Timestamps> & {
          id?: string;
          slug: string;
          title: string;
          description?: string | null;
          brand_id?: string | null;
          category_id?: string | null;
          gender?: Gender;
          color?: string | null;
          material?: string | null;
          image_urls?: string[];
          source_provider_id?: string | null;
          external_id?: string | null;
          is_mock?: boolean;
          is_active?: boolean;
        };
        Update: Partial<Database['public']['Tables']['products']['Insert']>;
        Relationships: [];
      };

      product_variants: {
        Row: Timestamps & {
          id: string;
          product_id: string;
          sku: string | null;
          size: string | null;
          color: string | null;
          image_url: string | null;
          availability: Availability;
          external_id: string | null;
        };
        Insert: Partial<Timestamps> & {
          id?: string;
          product_id: string;
          sku?: string | null;
          size?: string | null;
          color?: string | null;
          image_url?: string | null;
          availability?: Availability;
          external_id?: string | null;
        };
        Update: Partial<Database['public']['Tables']['product_variants']['Insert']>;
        Relationships: [];
      };

      prices: {
        Row: Timestamps & {
          id: string;
          product_id: string;
          variant_id: string | null;
          retailer_id: string;
          /** Integer minor units — pair with `currency` and lib/money.ts. */
          price_minor: number;
          original_minor: number | null;
          currency: string;
          availability: Availability;
          affiliate_url: string | null;
          product_url: string | null;
          observed_at: string;
        };
        Insert: Partial<Timestamps> & {
          id?: string;
          product_id: string;
          variant_id?: string | null;
          retailer_id: string;
          price_minor: number;
          original_minor?: number | null;
          currency?: string;
          availability?: Availability;
          affiliate_url?: string | null;
          product_url?: string | null;
          observed_at?: string;
        };
        Update: Partial<Database['public']['Tables']['prices']['Insert']>;
        Relationships: [];
      };

      /** Append-only. Nothing updates a historical observation. */
      price_history: {
        Row: {
          id: number;
          product_id: string;
          variant_id: string | null;
          retailer_id: string;
          price_minor: number;
          currency: string;
          observed_at: string;
        };
        Insert: {
          product_id: string;
          variant_id?: string | null;
          retailer_id: string;
          price_minor: number;
          currency?: string;
          observed_at?: string;
        };
        // Append-only, but expressed as a normal Update type: `never` here
        // breaks postgrest-js's table helpers. What actually stops a rewrite is
        // RLS — price_history has no update policy at all, so the attempt fails
        // at the database rather than at the compiler.
        Update: Partial<Database['public']['Tables']['price_history']['Insert']>;
        Relationships: [];
      };

      wishlists: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          note: string | null;
          notify_below_minor: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: string;
          note?: string | null;
          notify_below_minor?: number | null;
          created_at?: string;
        };
        Update: {
          note?: string | null;
          notify_below_minor?: number | null;
        };
        Relationships: [];
      };

      affiliate_clicks: {
        Row: {
          id: number;
          user_id: string | null;
          product_id: string | null;
          retailer_id: string | null;
          affiliate_provider_id: string | null;
          session_id: string | null;
          ip_hash: string | null;
          referrer: string | null;
          clicked_at: string;
        };
        Insert: {
          user_id?: string | null;
          product_id?: string | null;
          retailer_id?: string | null;
          affiliate_provider_id?: string | null;
          session_id?: string | null;
          ip_hash?: string | null;
          referrer?: string | null;
          clicked_at?: string;
        };
        // Append-only; enforced by RLS, which grants no update policy. See the
        // note on price_history above.
        Update: Partial<Database['public']['Tables']['affiliate_clicks']['Insert']>;
        Relationships: [];
      };
    };
    Views: {
      /**
       * Cheapest in-stock offer per product (migration 0002).
       * SECURITY INVOKER, so RLS on the underlying tables still applies.
       */
      product_best_offer: {
        Row: {
          product_id: string;
          price_id: string;
          retailer_id: string;
          variant_id: string | null;
          price_minor: number;
          original_minor: number | null;
          currency: string;
          availability: Availability;
          observed_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      /**
       * Keyword + filter + sort + pagination over the catalogue (migration 0002).
       *
       * Every argument is required here even though the SQL function defaults
       * them all. postgrest-js declares `Args` with a `never` default and infers
       * it from the call site; with optional properties that inference falls
       * back to `never`, and the call is then typed as taking no arguments at
       * all. Callers pass every argument explicitly, which is clearer anyway.
       */
      search_products: {
        Args: {
          search_query: string | null;
          brand_slugs: string[] | null;
          category_slug: string | null;
          gender_filter: Gender | null;
          retailer_slugs: string[] | null;
          min_price_minor: number | null;
          max_price_minor: number | null;
          in_stock_only: boolean;
          include_mock: boolean;
          sort_by: string;
          page_limit: number;
          page_offset: number;
        };
        Returns: {
          id: string;
          slug: string;
          title: string;
          description: string | null;
          gender: Gender;
          color: string | null;
          material: string | null;
          image_urls: string[];
          is_mock: boolean;
          created_at: string;
          brand_id: string | null;
          brand_slug: string | null;
          brand_name: string | null;
          category_id: string | null;
          category_slug: string | null;
          category_name: string | null;
          best_price_minor: number | null;
          best_original_minor: number | null;
          best_currency: string | null;
          best_availability: Availability | null;
          best_retailer_id: string | null;
          best_retailer_slug: string | null;
          best_retailer_name: string | null;
          offer_count: number;
          total_count: number;
        }[];
      };
    };
    Enums: {
      user_role: UserRole;
      gender: Gender;
      availability: Availability;
    };
    CompositeTypes: Record<never, never>;
  };
}

/** Row shorthand: `Tables<'products'>`. */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
