import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import prettier from 'eslint-config-prettier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'next-env.d.ts', 'coverage/**'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
          // `typeof import('x')` is how a lazily-imported SDK is typed without
          // statically pulling it into the bundle.
          disallowTypeAnnotations: false,
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../*'],
              message:
                'Reach across modules with the "@/" alias rather than deep relative paths.',
            },
          ],
        },
      ],
    },
  },
  // Layer rule: a client component may never import server-only modules.
  // `server-only` enforces this at build time too; this is the earlier, friendlier error.
  {
    files: ['src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/lib/env.server',
                '@/lib/supabase/admin',
                '@/lib/supabase/server',
                '@/modules/*/repository',
              ],
              message:
                'Server-only module. Components receive data as props or call /api/* (docs/architecture.md §2.2).',
            },
          ],
        },
      ],
    },
  },
  /**
   * The production startup file is CommonJS by necessity: package.json declares
   * no "type", and Passenger-style hosts load the startup file with require().
   * It is a Node entry point, not application code.
   */
  {
    files: ['index.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { __dirname: 'readonly', process: 'readonly', console: 'readonly' },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  prettier,
];

export default config;
