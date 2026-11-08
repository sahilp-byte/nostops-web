// ESLint flat config (Next.js 16 removed `next lint`; run `yarn lint` = `eslint .`).
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Project convention: remote backend payloads are untyped JSON handled at the BFF edge.
      '@typescript-eslint/no-explicit-any': 'off',
      // `_`-prefixed names are intentionally unused (ignored args, omitted destructured keys).
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', ignoreRestSiblings: true,
      }],
      // React Compiler–only rules: this app does not use the React Compiler, and the flagged
      // patterns (hydration-mount flags, Date.now() in server components / form timestamps,
      // pointer-drag refs) are intentional.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'node_modules/**', 'next-env.d.ts', 'tsconfig.tsbuildinfo']),
]);
