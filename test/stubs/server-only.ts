/**
 * Stand-in for the `server-only` package under Vitest.
 *
 * The real package exports nothing and exists to make a bundler fail when
 * server code is imported from a Client Component. Vitest is neither, so the
 * genuine article throws on import and takes the whole suite with it.
 *
 * Aliased in `vitest.config.mts`. This weakens nothing: the guarantee is
 * enforced at build time by `next build`, which still resolves the real
 * package.
 */
export {};
