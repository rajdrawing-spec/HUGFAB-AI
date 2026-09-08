/**
 * Next only ships declarations for CSS *modules*; a side-effect import of a
 * plain stylesheet has no type, which TypeScript 6 rejects (TS2882).
 * Bundlers handle these — TypeScript just needs to be told they exist.
 */
declare module '*.css';
declare module '*.scss';
declare module '*.sass';
