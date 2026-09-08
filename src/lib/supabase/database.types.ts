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
        Update: never;
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
        Update: never;
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
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
