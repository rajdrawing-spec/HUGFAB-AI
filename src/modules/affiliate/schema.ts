import { z } from 'zod';

/** Inputs to the click-out route. */
export const clickParamsSchema = z.object({
  product: z.string().uuid('must be a product id'),
  retailer: z.string().uuid('must be a retailer id'),
  /** Optional opaque session id, so anonymous clicks can be de-duplicated. */
  session: z.string().trim().min(8).max(128).optional(),
});

export type ClickParams = z.infer<typeof clickParamsSchema>;
