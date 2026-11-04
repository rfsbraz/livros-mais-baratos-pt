import globals from 'globals';
import js from '@eslint/js';
export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'work/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'store-listing/website/**'
    ]
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.webextensions, ...globals.node }
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      curly: ['error', 'all']
    }
  }
];
