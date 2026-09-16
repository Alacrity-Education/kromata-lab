import js from '@eslint/js';
import globals from 'globals';
import next from 'eslint-config-next';

// eslint-config-next 16 exports a flat-config array directly, not a factory.
const config = [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
  js.configs.recommended,
  ...next,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    // The core rules cannot see TypeScript's type positions: they flag parameter names in
    // interface method signatures as unused and React's JSX namespace as undefined. tsc already
    // covers both, and the TypeScript-aware rule from eslint-config-next handles the real cases.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },
];

export default config;
